import logging
from typing import Callable

from starlette.requests import Request
from starlette.responses import Response


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger("access-control-api")


async def log_requests_middleware(
    request: Request,
    call_next: Callable[[Request], Response],
) -> Response:
    logger.info("HTTP request %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info(
        "HTTP response %s %s - status %s",
        request.method,
        request.url.path,
        response.status_code,
    )
    return response

