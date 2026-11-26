"""OpenAI-format provider — translates Anthropic ↔ OpenAI formats."""
from __future__ import annotations
import json
import logging
import httpx
from typing import AsyncGenerator

from .base import BaseProvider, headers_for, url_for
from translate.request import anthropic_to_openai
from translate.response import openai_stream_to_anthropic

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """Translate Anthropic Messages requests to OpenAI Chat Completions."""

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
                    # Non-streaming: buffer full body, translate
                    body = await resp.aread()
                    data = json.loads(body)
                    result = _openai_nonstream_to_anthropic(data, request_body.get("model", provider_model))
                    yield (json.dumps(result) + "\n").encode("utf-8")


def _openai_nonstream_to_anthropic(openai_resp: dict, display_model: str) -> dict:
    """Translate a complete OpenAI response to Anthropic format."""
    choice = openai_resp.get("choices", [{}])[0]
    msg = choice.get("message", {})
    content_text = msg.get("content") or ""

    # Handle tool calls
    content_blocks = []
    if content_text:
        content_blocks.append({"type": "text", "text": content_text})

    for tc in msg.get("tool_calls", []):
        fn = tc.get("function", {})
        try:
            args = json.loads(fn.get("arguments", "{}"))
        except json.JSONDecodeError:
            args = {}
        content_blocks.append({
            "type": "tool_use",
            "id": tc.get("id", ""),
            "name": fn.get("name", ""),
            "input": args,
        })

    usage = openai_resp.get("usage", {})

    return {
        "id": openai_resp.get("id", ""),
        "type": "message",
        "role": "assistant",
        "content": content_blocks,
        "model": display_model,
        "stop_reason": _map_finish_reason(choice.get("finish_reason")),
        "stop_sequence": None,
        "usage": {
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
        },
    }


def _map_finish_reason(reason: str | None) -> str:
    if reason == "stop":
        return "end_turn"
    if reason == "length":
        return "max_tokens"
    if reason == "tool_calls":
        return "tool_use"
    return reason or "end_turn"


def _error_sse(status: str, detail: str) -> bytes:
    safe = detail.replace('"', "'")[:300]
    payload = json.dumps({
        "type": "error",
        "error": {
            "type": "api_error",
            "message": f"OpenAI provider error ({status}): {safe}",
        },
    })
    return f"event: error\ndata: {payload}\n\n".encode("utf-8")
