import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_get_transcription_status():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Requires auth
        response = await ac.get("/api/transcription/status/some_fake_id")
        assert response.status_code == 403
