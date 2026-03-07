from typing import Any, Dict

def success_response(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}

def error_response(message: str, data: Any = None) -> Dict[str, Any]:
    return {"success": False, "data": data, "message": message}
