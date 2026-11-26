"""Groq provider — OpenAI-compatible with reasoning model quirks."""
from __future__ import annotations
import json
import logging
import httpx
from typing import AsyncGenerator

from .base import BaseProvider, headers_for, url_for
from translate.request import anthropic_to_openai
from translate.response import openai_stream_to_anthropic

logger = logging.getLogger(__name__)


class GroqProvider(BaseProvider):
    """Translate Anthropic → OpenAI for Groq, with reasoning model handling."""

    async def stream(
        self, request_body: dict, provider_model: str, extra_headers: dict | None = None
    ) -> AsyncGenerator[bytes, None]:
        url = url_for(self)
        hdrs = headers_for(self, extra=extra_headers)

        try:
            oai_body = anthropic_to_openai(request_body, provider_model)
        except Exception as e:
            logger.error(f"[{self.label}] Translation error: {e}")
            yield _error_sse("translation_error", str(e))
            return

        # Groq-specific: reasoning models need extra_body for reasoning_effort
        if "gpt-oss" in provider_model or "deepseek-r1" in provider_model:
            oai_body["extra_body"] = {"reasoning_effort": "low"}
            # Reasoning tokens count toward max_tokens — bump budget
            if oai_body.get("max_tokens", 4096) < 1600:
                oai_body["max_tokens"] = 1600

        # Groq sometimes chokes on stream_options
        oai_body.pop("stream_options", None)

        logger.debug(f"[{self.label}] POST {url} model={provider_model}")

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            async with client.stream("POST", url, json=oai_body, headers=hdrs) as resp:
                if resp.status_code >= 400:
                    text = await resp.aread()
                    logger.error(
                        f"[{self.label}] HTTP {resp.status_code}: {text[:500]!r}"
                    )
                    yield _error_sse(resp.status_code, text.decode(errors="replace"))
                    return

                if oai_body.get("stream"):
                    async for event_bytes in openai_stream_to_anthropic(
                        resp.aiter_lines(), request_body.get("model", provider_model)
                    ):
                        yield event_bytes
                else:
                    from .openai import _openai_nonstream_to_anthropic
                    body = await resp.aread()
                    data = json.loads(body)
                    result = _openai_nonstream_to_anthropic(data, request_body.get("model", provider_model))
                    yield (json.dumps(result) + "\n").encode("utf-8")


def _error_sse(status: str, detail: str) -> bytes:
    safe = detail.replace('"', "'")[:300]
    payload = json.dumps({
        "type": "error",
        "error": {
            "type": "api_error",
            "message": f"Groq provider error ({status}): {safe}",
        },
    })
    return f"event: error\ndata: {payload}\n\n".encode("utf-8")
