from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import socketio

from .config import get_settings
from .database import init_db
from .api import api_router
from .socket import sio

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    print("Database initialized")
    yield
    # Shutdown
    print("Shutting down")


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST API routes
app.include_router(api_router, prefix="/api")

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, socketio_path="")
app.mount("/socket.io", socket_app)


@app.get("/")
async def root():
    return {
        "message": "Crypto Chat API",
        "docs": "/docs",
        "websocket": "/socket.io",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
