from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import socketio
import asyncio
import httpx
import os

from .config import get_settings
from .database import init_db
from .api import api_router
from .socket import sio

settings = get_settings()

# Keep-alive task to prevent Render free tier from spinning down
keep_alive_task = None

async def keep_alive():
    """Ping self every 10 minutes to keep the server warm on Render free tier."""
    # Get the app URL from environment or use default
    app_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("APP_URL")

    if not app_url:
        print("Keep-alive: No APP_URL or RENDER_EXTERNAL_URL set, skipping self-ping")
        return

    health_url = f"{app_url}/health"
    print(f"Keep-alive: Starting self-ping to {health_url}")

    async with httpx.AsyncClient() as client:
        while True:
            try:
                await asyncio.sleep(600)  # 10 minutes
                response = await client.get(health_url, timeout=30)
                print(f"Keep-alive: Pinged {health_url} - Status: {response.status_code}")
            except asyncio.CancelledError:
                print("Keep-alive: Task cancelled")
                break
            except Exception as e:
                print(f"Keep-alive: Ping failed - {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global keep_alive_task

    # Startup
    await init_db()
    print("Database initialized")

    # Start keep-alive background task
    keep_alive_task = asyncio.create_task(keep_alive())

    yield

    # Shutdown
    if keep_alive_task:
        keep_alive_task.cancel()
        try:
            await keep_alive_task
        except asyncio.CancelledError:
            pass
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
