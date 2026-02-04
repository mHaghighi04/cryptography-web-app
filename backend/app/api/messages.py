from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime

from ..database import get_db
from ..models import User, Conversation, Message
from ..schemas import (
    ConversationResponse,
    ConversationWithMessages,
    MessageCreate,
    MessageResponse,
    UserResponse,
)
from ..utils.security import get_current_user

router = APIRouter()


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for the current user."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.participant1), selectinload(Conversation.participant2))
        .where(
            or_(
                Conversation.participant1_id == current_user.id,
                Conversation.participant2_id == current_user.id,
            )
        )
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        other = conv.get_other_participant(current_user.id)
        conv_response = ConversationResponse.model_validate(conv)
        conv_response.other_participant = UserResponse.model_validate(other)
        response.append(conv_response)

    return response


@router.post("/with/{user_id}", response_model=ConversationResponse)
async def get_or_create_conversation(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get or create a conversation with another user."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create conversation with yourself"
        )

    # Check if other user exists
    result = await db.execute(select(User).where(User.id == user_id))
    other_user = result.scalar_one_or_none()

    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check for existing conversation
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.participant1), selectinload(Conversation.participant2))
        .where(
            or_(
                and_(
                    Conversation.participant1_id == current_user.id,
                    Conversation.participant2_id == user_id,
                ),
                and_(
                    Conversation.participant1_id == user_id,
                    Conversation.participant2_id == current_user.id,
                ),
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        # Create new conversation
        conversation = Conversation(
            participant1_id=current_user.id,
            participant2_id=user_id,
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

        # Load relationships
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.participant1), selectinload(Conversation.participant2))
            .where(Conversation.id == conversation.id)
        )
        conversation = result.scalar_one()

    conv_response = ConversationResponse.model_validate(conversation)
    conv_response.other_participant = UserResponse.model_validate(other_user)
    return conv_response


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get conversation with messages."""
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.participant1),
            selectinload(Conversation.participant2),
        )
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    # Verify user is participant
    if conversation.participant1_id != current_user.id and conversation.participant2_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant in this conversation"
        )

    # Get messages with pagination
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    messages = result.scalars().all()

    # Reverse to get chronological order
    messages = list(reversed(messages))

    other = conversation.get_other_participant(current_user.id)
    conv_response = ConversationWithMessages.model_validate(conversation)
    conv_response.other_participant = UserResponse.model_validate(other)
    conv_response.messages = [MessageResponse.model_validate(m) for m in messages]

    return conv_response


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send an encrypted message.
    This is a fallback for when WebSocket is not available.
    Prefer using Socket.IO for real-time messaging.
    """
    # Verify conversation exists and user is participant
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.participant1_id != current_user.id and conversation.participant2_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant in this conversation"
        )

    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        ciphertext=message_data.ciphertext,
        nonce=message_data.nonce,
        signature=message_data.signature,
        encrypted_key_sender=message_data.encrypted_key_sender,
        encrypted_key_recipient=message_data.encrypted_key_recipient,
        cipher_type=message_data.cipher_type,
    )

    db.add(message)

    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(message)

    return MessageResponse.model_validate(message)
