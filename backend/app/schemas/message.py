from pydantic import BaseModel
from datetime import datetime


class MessageCreate(BaseModel):
    """Message creation - client sends plaintext, server encrypts."""
    content: str


class MessageResponse(BaseModel):
    """Message response - server decrypts and returns plaintext."""
    id: str
    conversation_id: str
    sender_id: str
    content: str  # Decrypted plaintext
    created_at: datetime

    class Config:
        from_attributes = True


class MessageSocket(BaseModel):
    """Message format for Socket.IO events - client sends plaintext."""
    conversation_id: str
    content: str
