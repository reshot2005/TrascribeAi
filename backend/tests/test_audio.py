import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_upload_invalid_file():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Test auth first
        response = await ac.post("/api/audio/upload")
        assert response.status_code == 403
