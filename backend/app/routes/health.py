from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
async def health():
    """Health check endpoint"""
    from app.providers.registry import provider_registry

    return {
        "status": "healthy",
        "providers": provider_registry.get_provider_names(),
    }
