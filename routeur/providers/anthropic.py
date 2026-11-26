"""Pass-through provider for Anthropic-format APIs (Anthropic, DeepSeek)."""
from __future__ import annotations
import logging
import httpx
from typing import AsyncGenerator

from .base import BaseProvider, headers_for, url_for

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseProvider):
    """Forward the request as-is to an Anthropic-compatible endpoint."""

    async def stream(
        self, request_body: dict, provider_model: str, extra_headers: dict | None = None
    ) -> AsyncGenerator[bytes, None]:
        url = url_for(self)
        hdrs = headers_for(self, extra=extra_headers)

        # Patch the model name to the provider's own name
        body = {**request_body, "model": provider_model}

        logger.debug(f"[{self.label}] POST {url} model={provider_model} stream={body.get('stream', True)}")

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            async with client.stream("POST", url, json=body, headers=hdrs) as resp:
                if resp.status_code >= 400:
                    text = await resp.aread()
                    logger.error(
                        f"[{self.label}] HTTP {resp.status_code}: {text[:500]!r}"
                    )
                    # Yield an error event so the client doesn't hang
                    yield _error_sse(resp.status_code, text.decode(errors="replace"))
                    return

                async for line in resp.aiter_lines():
                    yield (line + "\n").encode("utf-8")


def _error_sse(status: int, detail: str) -> bytes:
    import json
    safe = detail.replace('"', "'")[:300]
    payload = json.dumps({
        "type": "error",
        "error": {
            "type": "api_error",
            "message": f"Provider returned HTTP {status}: {safe}",
        },
    })
    return f"event: error\ndata: {payload}\n\n".encode("utf-8")
