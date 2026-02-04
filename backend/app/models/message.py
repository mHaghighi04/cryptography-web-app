import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import relationship
from ..database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(CHAR(36), ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(CHAR(36), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)  # Encrypted content
    nonce = Column(String(48), nullable=False)  # For decryption
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])

    def __repr__(self):
        return f"<Message {self.id}>"
