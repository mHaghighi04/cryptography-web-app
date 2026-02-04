import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    salt = Column(String(64), nullable=False)
    password_hash = Column(String(128), nullable=False)
    encrypted_private_key = Column(Text, nullable=False)
    public_key = Column(Text, nullable=False)
    requires_key_migration = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)

    # Certificate Authority fields
    csr = Column(Text, nullable=True)  # PEM-encoded CSR
    certificate = Column(Text, nullable=True)  # PEM-encoded signed certificate
    certificate_status = Column(String(20), default="none")  # none/pending/active/expired/revoked
    certificate_expires_at = Column(DateTime, nullable=True)
    certificate_serial = Column(String(50), nullable=True)

    # Relationships
    sent_messages = relationship(
        "Message",
        back_populates="sender",
        foreign_keys="Message.sender_id"
    )

    def __repr__(self):
        return f"<User {self.username}>"
