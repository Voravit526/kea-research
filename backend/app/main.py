import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import validate_admin_password

logger = logging.getLogger(__name__)
from app.routes import admin, chat, health, tts, users
from app.providers.registry import provider_registry
from app.database import init_db, async_session, cleanup_expired_sessions
from app.utils.seed import seed_from_env, migrate_existing_db, seed_provider_sets

# Validate admin password before app starts
validate_admin_password()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events"""
    # Initialize database
    await init_db()

    # Migrate existing databases (one-time for databases without initialization tracking)
    async with async_session() as session:
        migration_result = await migrate_existing_db(session)
        if migration_result["status"] == "migrated":
            logger.info(f"Database migration: {migration_result['message']}")

    # Seed database from .env if not initialized
    async with async_session() as session:
        result = await seed_from_env(session)
        if result["status"] == "success":
            logger.info(f"Database seeded: {result['providers_created']} providers, {result['models_created']} models")

    # Seed/update system provider sets
    async with async_session() as session:
        result = await seed_provider_sets(session)
        logger.info(
            f"Provider sets: {result['sets_created']} created, {result['sets_updated']} updated, "
            f"{result['providers_created']} providers, {result['members_created']} members"
        )

    # Cleanup expired sessions
    await cleanup_expired_sessions()

    # Startup: Initialize provider registry from database
    await provider_registry.initialize()

    yield

    # Shutdown: Cleanup resources
    await provider_registry.cleanup()


app = FastAPI(
    title="KEA Backend API",
    description="Multi-provider AI chat API with SSE streaming",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware (nginx handles external access, but useful for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(tts.router, prefix="/api", tags=["tts"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(users.router, prefix="/api", tags=["users"])
