from fastapi import APIRouter

from ..categories import CATEGORIES

router = APIRouter()


@router.get("/categories")
async def list_categories():
    return {"categories": CATEGORIES}
