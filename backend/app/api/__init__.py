from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .messages import router as messages_router
from .certificates import router as certificates_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(messages_router, prefix="/conversations", tags=["conversations"])
api_router.include_router(certificates_router, prefix="/certificates", tags=["certificates"])
