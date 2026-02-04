import socketio
from datetime import datetime
from typing import Dict, Set, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from ..database import AsyncSessionLocal
from ..models import User, Conversation, Message
from ..utils.security import get_user_from_token
from ..utils.crypto import encrypt_message, decrypt_message
from ..config import get_settings

settings = get_settings()

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins,
    logger=settings.debug,
    engineio_logger=settings.debug,
)

# Create ASGI app
socket_app = socketio.ASGIApp(sio)

# Store connected users: {user_id: {sid, username}}
connected_users: Dict[str, Dict] = {}
# Store which conversations each sid is in
sid_conversations: Dict[str, Set[str]] = {}


async def get_user_from_sid(sid: str) -> Optional[User]:
    """Get user from session ID."""
    for user_id, data in connected_users.items():
        if data.get("sid") == sid:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                return result.scalar_one_or_none()
    return None


@sio.event
async def connect(sid, environ, auth):
    """Handle client connection with JWT authentication."""
    token = auth.get("token") if auth else None

    if not token:
        print(f"Connection rejected: No token provided (sid={sid})")
        return False

    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)

        if not user:
            print(f"Connection rejected: Invalid token (sid={sid})")
            return False

        # Update user online status
        user.is_online = True
        user.last_seen = datetime.utcnow()
        await db.commit()

        # Store connection
        connected_users[user.id] = {"sid": sid, "username": user.username}
        sid_conversations[sid] = set()

        print(f"User {user.username} connected (sid={sid})")

        # Notify other users
        await sio.emit(
            "user_online",
            {"user_id": user.id, "username": user.username},
            skip_sid=sid,
        )

        return True


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    user_id = None
    username = None

    # Find user by sid
    for uid, data in list(connected_users.items()):
        if data.get("sid") == sid:
            user_id = uid
            username = data.get("username")
            del connected_users[uid]
            break

    # Clean up conversation rooms
    if sid in sid_conversations:
        del sid_conversations[sid]

    if user_id:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                await db.commit()

        print(f"User {username} disconnected (sid={sid})")

        # Notify other users
        await sio.emit(
            "user_offline",
            {"user_id": user_id, "username": username},
            skip_sid=sid,
        )


@sio.event
async def join_conversation(sid, data):
    """Join a conversation room."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return {"error": "conversation_id required"}

    user = await get_user_from_sid(sid)
    if not user:
        return {"error": "Not authenticated"}

    async with AsyncSessionLocal() as db:
        # Verify user is participant
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            return {"error": "Conversation not found"}

        if conversation.participant1_id != user.id and conversation.participant2_id != user.id:
            return {"error": "Not a participant"}

    # Join the room
    await sio.enter_room(sid, conversation_id)
    sid_conversations[sid].add(conversation_id)

    print(f"User {user.username} joined conversation {conversation_id}")
    return {"success": True}


@sio.event
async def leave_conversation(sid, data):
    """Leave a conversation room."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return {"error": "conversation_id required"}

    await sio.leave_room(sid, conversation_id)
    if sid in sid_conversations:
        sid_conversations[sid].discard(conversation_id)

    return {"success": True}


@sio.event
async def send_message(sid, data):
    """
    Handle sending a message.
    Client sends plaintext, server encrypts before storing.
    """
    conversation_id = data.get("conversation_id")
    content = data.get("content")

    if not conversation_id or not content:
        return {"error": "Missing required fields (conversation_id, content)"}

    user = await get_user_from_sid(sid)
    if not user:
        return {"error": "Not authenticated"}

    async with AsyncSessionLocal() as db:
        # Verify conversation and participation
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.participant1), selectinload(Conversation.participant2))
            .where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            return {"error": "Conversation not found"}

        if conversation.participant1_id != user.id and conversation.participant2_id != user.id:
            return {"error": "Not a participant"}

        # Encrypt message on server
        ciphertext, nonce = encrypt_message(content)

        # Create message
        message = Message(
            conversation_id=conversation_id,
            sender_id=user.id,
            ciphertext=ciphertext,
            nonce=nonce,
        )

        db.add(message)
        conversation.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(message)

        print(f"Message saved: id={message.id}, conversation={conversation_id}, content_length={len(content)}")

        # Prepare message data for broadcast (plaintext for clients)
        message_data = {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "content": content,  # Send plaintext to clients
            "created_at": message.created_at.isoformat(),
        }

        # Broadcast to conversation room (including sender for confirmation)
        await sio.emit("new_message", message_data, room=conversation_id)

        # Also notify the other participant if not in the room
        other_user_id = (
            conversation.participant2_id
            if conversation.participant1_id == user.id
            else conversation.participant1_id
        )

        if other_user_id in connected_users:
            other_sid = connected_users[other_user_id]["sid"]
            if other_sid not in sid_conversations or conversation_id not in sid_conversations.get(other_sid, set()):
                # User is online but not in this conversation room
                await sio.emit(
                    "message_notification",
                    {
                        "conversation_id": conversation_id,
                        "sender_id": user.id,
                        "sender_username": user.username,
                    },
                    to=other_sid,
                )

        return {"success": True, "message_id": message.id}


@sio.event
async def typing(sid, data):
    """Handle typing indicator start."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return

    user = await get_user_from_sid(sid)
    if not user:
        return

    await sio.emit(
        "user_typing",
        {"user_id": user.id, "username": user.username},
        room=conversation_id,
        skip_sid=sid,
    )


@sio.event
async def stop_typing(sid, data):
    """Handle typing indicator stop."""
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return

    user = await get_user_from_sid(sid)
    if not user:
        return

    await sio.emit(
        "user_stopped_typing",
        {"user_id": user.id, "username": user.username},
        room=conversation_id,
        skip_sid=sid,
    )


@sio.event
async def get_online_users(sid, data):
    """Get list of currently online users."""
    online_list = [
        {"user_id": uid, "username": info["username"]}
        for uid, info in connected_users.items()
    ]
    return {"online_users": online_list}
