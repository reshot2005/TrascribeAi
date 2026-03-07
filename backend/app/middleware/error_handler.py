from fastapi import Request
from fastapi.responses import JSONResponse
import traceback
import logging

logger = logging.getLogger(__name__)

async def global_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    logger.error(f"Global Exception: {error_msg}")
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "An internal server error occurred.", "error": error_msg}
    )
