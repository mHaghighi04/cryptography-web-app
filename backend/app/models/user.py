import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import relationship
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    salt = Column(String(64), nullable=False)
    password_hash = Column(String(128), nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    public_key = Column(Text, nullable=False)
    requires_key_migration = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sent_messages = relationship(
        "Message",
        back_populates="sender",
        foreign_keys="Message.sender_id"
    )

    def __repr__(self):
        return f"<User {self.username}>"
