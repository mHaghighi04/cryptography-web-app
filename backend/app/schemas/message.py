from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MessageCreate(BaseModel):
    ciphertext: str
    nonce: str
    signature: str
    encrypted_key_sender: str
    encrypted_key_recipient: str
    cipher_type: str = "aes-256-gcm"


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    ciphertext: str
    nonce: str
    signature: str
    encrypted_key_sender: str
    encrypted_key_recipient: str
    cipher_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageSocket(BaseModel):
    """Message format for Socket.IO events."""
    conversation_id: str
    ciphertext: str
    nonce: str
    signature: str
    encrypted_key_sender: str
    encrypted_key_recipient: str
    cipher_type: str = "aes-256-gcm"
