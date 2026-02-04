# Crypto Chat Web

A modern web-based secure messaging application with end-to-end encryption. All encryption/decryption happens in the browser - the server never sees plaintext messages or unencrypted private keys.

## Features

- **End-to-End Encryption**: Messages encrypted with AES-256-GCM, keys wrapped with RSA-2048-OAEP
- **Digital Signatures**: All messages signed with RSA-PSS for authentication
- **Real-time Messaging**: WebSocket-based instant message delivery
- **Typing Indicators**: See when others are typing
- **Online Presence**: Know who's online

## Security Architecture

```
Browser (React)                    Server (FastAPI)
    │                                   │
    │ ← Web Crypto API →                │
    │   - Key generation                │
    │   - Encrypt/decrypt               │
    │   - Sign/verify                   │
    │                                   │
    ├── REST API (HTTPS) ──────────────→│ ← SQLAlchemy
    │   - Auth, users, messages         │   - Users table
    │                                   │   - Messages table
    └── WebSocket (Socket.IO) ─────────→│   - Conversations table
        - Real-time messages            │
```

**Key Security Property**: The server only sees encrypted data. Private keys are decrypted only in browser memory.

## Cryptographic Operations

| Operation | Algorithm |
|-----------|-----------|
| Password KDF | Scrypt (N=2^14, r=8, p=1) |
| Key Generation | RSA-2048 |
| Key Wrapping | RSA-OAEP-SHA256 |
| Message Encryption | AES-256-GCM |
| Digital Signatures | RSA-PSS-SHA256 |

## Quick Start

### Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Production (Docker)

```bash
docker-compose up --build
```

Access the app at http://localhost:3000

## Project Structure

```
crypto-chat-web/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI + Socket.IO entry
│   │   ├── config.py            # Configuration
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models/              # User, Message, Conversation
│   │   ├── schemas/             # Pydantic models
│   │   ├── api/                 # REST endpoints
│   │   ├── socket/              # Socket.IO handlers
│   │   └── utils/               # JWT utilities
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── services/            # API, Socket, Crypto
│   │   ├── hooks/               # State management
│   │   └── types/               # TypeScript types
│   └── package.json
└── docker-compose.yml
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login/init` - Get salt for client-side hashing
- `POST /api/auth/login` - Authenticate and get tokens
- `POST /api/auth/refresh` - Refresh access token

### Users
- `GET /api/users` - List all users
- `GET /api/users/search?q=` - Search users
- `GET /api/users/{id}/public-key` - Get user's public key

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations/with/{user_id}` - Get/create conversation
- `GET /api/conversations/{id}` - Get messages

## Socket.IO Events

### Client → Server
- `join_conversation` - Join chat room
- `send_message` - Send encrypted message
- `typing` / `stop_typing` - Typing indicator

### Server → Client
- `new_message` - Receive encrypted message
- `user_online` / `user_offline` - Presence
- `user_typing` / `user_stopped_typing` - Typing indicator

## Migration from CLI App

To migrate users from the existing `crypto.json`:

```bash
cd backend
python migrate_users.py ../crypto.json
```

Note: Migrated users will need to log in again to re-encrypt their private keys in Web Crypto compatible format.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./crypto_chat.db` | Database connection string |
| `SECRET_KEY` | (required in prod) | JWT signing key |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins |
| `DEBUG` | `true` | Enable debug mode |
