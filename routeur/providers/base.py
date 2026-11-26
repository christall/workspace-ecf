"""Abstract provider + factory to instantiate the right adapter."""
from __future__ import annotations
import os
import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


class BaseProvider(ABC):
    """All providers expose the same interface: accept Anthropic-format request,
    return Anthropic-format SSE stream."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.label: str = cfg["label"]
        self.base_url: str = cfg["base_url"]
        self.api_key: str = _read_api_key(cfg.get("api_key_env", []))
        self.format: str = cfg["format"]
        self.auth_header: str = cfg.get("auth_header", "x-api-key")
        self.anthropic_version: str = cfg.get("anthropic_version", "2023-06-01")

    @abstractmethod
    async def stream(
        self, request_body: dict, provider_model: str, extra_headers: dict | None = None
    ) -> AsyncGenerator[bytes, None]:
        """Yield raw SSE bytes (Anthropic-compatible)."""
        ...

    async def streaming_allowed(self) -> bool:
        """Override to disable streaming (e.g. Groq reasoning models)."""
        return True


def _read_api_key(env_names: str | list[str]) -> str:
    """Try multiple env var names, return the first non-empty value."""
    if isinstance(env_names, str):
        env_names = [env_names]
    for name in env_names:
        val = os.getenv(name, "")
        if val:
            logger.debug(f"Provider key: {name}")
            return val
    logger.debug(f"No key found among: {env_names}")
    return ""


def _build_auth_headers(provider: BaseProvider) -> dict:
    ah = provider.auth_header.lower()
    if ah == "x-api-key":
        return {"x-api-key": provider.api_key}
    if ah == "authorization":
        return {"Authorization": f"Bearer {provider.api_key}"}
    return {ah: provider.api_key}


def headers_for(provider: BaseProvider, extra: dict | None = None) -> dict:
    """Return headers for this provider's API call.

    ``extra`` can contain headers forwarded from the original client request
    (e.g. ``anthropic-beta`` for beta features like context management).
    """
    h = _build_auth_headers(provider)
    if provider.format == "anthropic":
        h["anthropic-version"] = provider.anthropic_version
    h["content-type"] = "application/json"
    if extra:
        # Prefix reserved keys so the client can't override auth / version
        for k, v in extra.items():
            if k.lower() not in ("x-api-key", "authorization", "anthropic-version", "content-type"):
                h[k] = v
    return h


def url_for(provider: BaseProvider) -> str:
    """Return the POST URL for this provider."""
    if provider.format == "anthropic":
        return f"{provider.base_url.rstrip('/')}/v1/messages"
    # OpenAI format
    return f"{provider.base_url.rstrip('/')}/chat/completions"
