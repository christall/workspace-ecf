#!/usr/bin/env python3
"""Claude Code Model Router — proxy Anthropic-compatible multi-provider API.

Usage:
  python main.py              # start server (reads config.yaml)
  python main.py --port 8787  # custom port
  python main.py --check      # validate config and exit
"""

from __future__ import annotations
import argparse
import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from typing import AsyncGenerator
from router import Router
from providers.base import BaseProvider
from providers.anthropic import AnthropicProvider
from providers.openai import OpenAIProvider
from providers.groq import GroqProvider

# ── Bootstrap ──────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("routeur")

# ── Config ─────────────────────────────────────────────────────────────
def load_config(path: Path | None = None) -> dict:
    path = path or ROOT / "config.yaml"
    if not path.exists():
        logger.error(f"config.yaml introuvable : {path}")
        sys.exit(1)
    with open(path) as f:
        return yaml.safe_load(f)


def init_providers(cfg: dict) -> dict[str, BaseProvider]:
    """Return a dict of provider_name → instantiated provider (only if API key is set)."""
    factory = {
        "anthropic": AnthropicProvider,
        "claude-pro": AnthropicProvider,  # OAuth Bearer (abonnement Pro)
        "deepseek": AnthropicProvider,   # Anthropic-format pass-through
        "openai": OpenAIProvider,
        "groq": GroqProvider,
        "mistral": OpenAIProvider,       # OpenAI-compatible (same adapter as OpenAI)
    }
    providers: dict[str, BaseProvider] = {}
    for name, pcfg in cfg.get("providers", {}).items():
        cls = factory.get(name)
        if cls is None:
            logger.warning(f"[init] Provider '{name}' ignoré — pas de classe pour format={pcfg.get('format')}")
            continue
        instance = cls(pcfg)
        if not instance.api_key:
            key_names = pcfg.get("api_key_env", "?")
            logger.warning(f"[init] Provider '{name}' ignoré — {key_names} non défini")
            continue
        providers[name] = instance
        logger.info(f"[init] Provider '{name}' OK ({instance.label})")
    return providers


# ── Globals (set by lifespan) ──────────────────────────────────────────
_router: Router | None = None
_providers: dict[str, BaseProvider] = {}
_cfg: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _router, _providers, _cfg
    _cfg = load_config()
    _router = Router(_cfg)
    _providers = init_providers(_cfg)
    sv = _cfg.get("server", {})
    logger.info(
        f"Routeur prêt — {len(_providers)} providers: {list(_providers.keys())}, "
        f"{len(_cfg.get('models',{}))} modèles enregistrés"
    )
    yield


app = FastAPI(title="Claude Code Model Router", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Helpers ────────────────────────────────────────────────────────────

def _get_roundtable_config(request_body: dict) -> dict | None:
    """Detect roundtable mode."""
    # Explicit model name
    if request_body.get("model") == "roundtable":
        name = "default"
        # Check for named roundtable in user message
        msgs = request_body.get("messages", [])
        if msgs:
            last = msgs[-1].get("content", "")
            if isinstance(last, list):
                last = " ".join(b.get("text", "") for b in last if isinstance(b, dict) and b.get("type") == "text")
            if isinstance(last, str) and last.startswith("[roundtable:"):
                # Extract name: [roundtable:quick] or [roundtable:default]
                import re
                m = re.match(r"\[roundtable:(\w+)\]", last)
                if m:
                    name = m.group(1)
        return _router.get_roundtable(name) if _router else None

    # [roundtable] prefix in prompt
    msgs = request_body.get("messages", [])
    if msgs:
        last = msgs[-1].get("content", "")
        if isinstance(last, list):
            last = " ".join(b.get("text", "") for b in last if isinstance(b, dict) and b.get("type") == "text")
        if isinstance(last, str) and "[roundtable]" in last.lower():
            return _router.get_roundtable("default") if _router else None

    return None


async def _stream_provider(
    provider: BaseProvider,
    request_body: dict,
    provider_model: str,
    model_override: str | None = None,
) -> bytes:
    """Stream from a single provider, optionally rewriting the model name.

    When `model_override` is set, the ``message_start`` event's model field
    is patched so the client sees the name it originally requested (e.g.
    "roundtable") rather than the underlying provider's model (e.g.
    "deepseek-v4-pro").  Without this, Claude Code rejects responses where
    the model in the SSE doesn't match the model it sent.
    """
    if model_override is None:
        chunks = []
        async for chunk in provider.stream(request_body, provider_model):
            chunks.append(chunk)
        return b"".join(chunks)

    # Streaming with model-name rewriting — buffer line-by-line so we can
    # intercept the message_start event without loading everything at once.
    import json as _json
    lines_out: list[bytes] = []
    async for line_bytes in provider.stream(request_body, provider_model):
        line = line_bytes.decode("utf-8", errors="replace").rstrip("\n")
        if line.startswith("data:") and "message_start" in line:
            try:
                data = _json.loads(line[5:].strip())
                if data.get("type") == "message_start":
                    data["message"]["model"] = model_override
                    line = "data: " + _json.dumps(data, ensure_ascii=False)
            except (_json.JSONDecodeError, KeyError):
                pass
        lines_out.append((line + "\n").encode("utf-8"))
    return b"".join(lines_out)


async def _run_roundtable(
    request_body: dict,
    rt_cfg: dict,
) -> bytes:
    """Fan out to N analysts, optionally synthesize with arbitrator."""
    analysts = rt_cfg.get("analysts", [])
    arbitrator_model = rt_cfg.get("arbitrator")
    mode = rt_cfg.get("mode", "debate")

    logger.info(f"[roundtable] {len(analysts)} analystes, mode={mode}, arbitre={arbitrator_model}")

    # Phase 1: fan-out to all analysts
    tasks = []
    for model_name in analysts:
        entry = _router.models.get(model_name) if _router else None
        if not entry:
            logger.warning(f"[roundtable] Modèle inconnu: {model_name}")
            continue
        provider_name = entry["provider"]
        provider_model = entry.get("provider_model", model_name)
        provider = _providers.get(provider_name)
        if not provider:
            logger.warning(f"[roundtable] Provider non disponible: {provider_name}")
            continue

        body = {**request_body, "model": model_name}
        tasks.append((model_name, provider, provider_model, body))

    if len(tasks) < 2:
        logger.warning("[roundtable] <2 analystes dispos, fallback direct")
        if tasks:
            _, provider, provider_model, body = tasks[0]
            return await _stream_provider(
                provider, body, provider_model,
                model_override=request_body.get("model"),
            )
        return _error_bytes("Aucun analyste disponible pour la table ronde")

    # Run all in parallel
    results: list[tuple[str, str]] = []  # [(model_name, response_text)]
    async def _run_one(name, provider, pmodel, body):
        raw = await _stream_provider(provider, body, pmodel)
        text = _extract_text_from_anthropic_sse(raw)
        return name, text

    gathered = await asyncio.gather(
        *[_run_one(name, p, pm, b) for name, p, pm, b in tasks],
        return_exceptions=True,
    )
    for item in gathered:
        if isinstance(item, Exception):
            logger.error(f"[roundtable] Analyste en erreur: {item}")
        else:
            results.append(item)

    logger.info(f"[roundtable] {len(results)}/{len(tasks)} analystes OK")

    if mode == "synthesize" and arbitrator_model and len(results) >= 2:
        return await _synthesize_roundtable(request_body, results, arbitrator_model)
    else:
        return _format_debate_response(results, request_body.get("model", "roundtable"))


async def _synthesize_roundtable(
    request_body: dict,
    results: list[tuple[str, str]],
    arbitrator_model: str,
) -> bytes:
    """Send all analyst responses to the arbitrator for synthesis."""
    entry = _router.models.get(arbitrator_model) if _router else None
    if not entry:
        logger.warning(f"[roundtable] Arbitre inconnu: {arbitrator_model}, fallback debate")
        return _format_debate_response(results, request_body.get("model", "roundtable"))

    provider_name = entry["provider"]
    provider_model = entry.get("provider_model", arbitrator_model)
    provider = _providers.get(provider_name)
    if not provider:
        logger.warning(f"[roundtable] Arbitre non disponible: {provider_name}")
        return _format_debate_response(results, request_body.get("model", "roundtable"))

    # Build meta-prompt
    debate_text = _format_debate_text(results)
    original_prompt = ""
    msgs = request_body.get("messages", [])
    if msgs:
        last = msgs[-1].get("content", "")
        if isinstance(last, list):
            last = " ".join(b.get("text", "") for b in last if isinstance(b, dict) and b.get("type") == "text")
        original_prompt = last if isinstance(last, str) else ""

    system = (
        "Tu es un arbitre senior. Tu viens de consulter plusieurs experts IA qui ont "
        "donné des avis indépendants sur une même question. Ta tâche est de synthétiser "
        "leurs analyses, identifier les points de consensus et de divergence, et fournir "
        "une réponse finale équilibrée et actionable. Ne te contente pas de répéter — "
        "tranche quand il le faut, explique pourquoi tu penches dans un sens plutôt qu'un autre."
    )
    meta_body = {
        "model": arbitrator_model,
        "max_tokens": request_body.get("max_tokens", 4096),
        "system": system,
        "messages": [
            {
                "role": "user",
                "content": (
                    f"## Question originale\n{original_prompt}\n\n"
                    f"## Analyses des experts ({len(results)} consultés)\n{debate_text}\n\n"
                    f"## Instructions\n"
                    f"Synthétise ces analyses. Identifie :\n"
                    f"1. Les points de consensus (ce sur quoi tous s'accordent)\n"
                    f"2. Les divergences (ce sur quoi ils sont en désaccord)\n"
                    f"3. Ta conclusion finale\n"
                    f"Sois concis mais complet."
                ),
            }
        ],
        "stream": request_body.get("stream", True),
    }

    logger.info(f"[roundtable] Arbitrage: {arbitrator_model} via {provider_name}")
    return await _stream_provider(
        provider, meta_body, provider_model,
        model_override=request_body.get("model", "roundtable"),
    )


def _format_debate_text(results: list[tuple[str, str]]) -> str:
    parts = []
    for i, (name, text) in enumerate(results, 1):
        parts.append(f"### Expert {i}: {name}\n{text[:3000]}\n")
    return "\n".join(parts)


def _format_debate_response(results: list[tuple[str, str]], display_model: str) -> bytes:
    """Format analyst responses as a debate (non-synthesized).

    Returns SSE-wrapped bytes for compatibility with both streaming and
    non-streaming paths.  The bytes are valid Anthropic SSE events:
    message_start → content_block_start → content_block_delta →
    content_block_stop → message_delta → message_stop.
    """
    parts = [f"## Table ronde — {len(results)} modèles consultés\n"]
    for i, (name, text) in enumerate(results, 1):
        clean = text.strip()[:4000]
        parts.append(f"### {name}\n{clean}\n")

    full_text = "\n".join(parts)
    msg_id = f"msg_rt_{id(results)}"
    output_tokens = max(len(full_text) // 4, 1)

    events = [
        ("message_start", {"type": "message_start", "message": {
            "id": msg_id, "type": "message", "role": "assistant",
            "model": display_model, "content": [], "stop_reason": None,
            "stop_sequence": None, "usage": {"input_tokens": 0},
        }}),
        ("content_block_start", {"type": "content_block_start", "index": 0,
            "content_block": {"type": "text", "text": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0,
            "delta": {"type": "text_delta", "text": full_text}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", {"type": "message_delta",
            "delta": {"stop_reason": "end_turn"},
            "usage": {"output_tokens": output_tokens}}),
        ("message_stop", {"type": "message_stop"}),
    ]

    lines = []
    for event_type, data in events:
        lines.append(f"event: {event_type}")
        lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
        lines.append("")
    return "\n".join(lines).encode("utf-8")


def _json_response_as_sse(body: dict) -> bytes:
    """Convert a non-streaming Anthropic response dict to SSE event bytes.

    Used by the fast-path when the client requested stream=true so that
    Claude Code's streaming parser can validate the response correctly.
    """
    msg_id = body["id"]
    model = body.get("model", "roundtable")
    text = ""
    for block in body.get("content", []):
        if isinstance(block, dict) and block.get("type") == "text":
            text += block.get("text", "")
    input_tokens = body.get("usage", {}).get("input_tokens", 0)
    output_tokens = body.get("usage", {}).get("output_tokens", 0)
    stop_reason = body.get("stop_reason", "end_turn")

    events = [
        ("message_start", {"type": "message_start", "message": {
            "id": msg_id, "type": "message", "role": "assistant",
            "model": model, "content": [], "stop_reason": None,
            "stop_sequence": None,
            "usage": {"input_tokens": input_tokens, "output_tokens": 0},
        }}),
        ("content_block_start", {"type": "content_block_start", "index": 0,
            "content_block": {"type": "text", "text": ""}}),
    ]
    if text:
        events.append(
            ("content_block_delta", {"type": "content_block_delta", "index": 0,
                "delta": {"type": "text_delta", "text": text}}),
        )
    events.append(
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
    )
    events.append(
        ("message_delta", {"type": "message_delta",
            "delta": {"stop_reason": stop_reason},
            "usage": {"output_tokens": output_tokens}}),
    )
    events.append(
        ("message_stop", {"type": "message_stop"}),
    )

    lines = []
    for event_type, data in events:
        lines.append(f"event: {event_type}")
        lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
        lines.append("")
    return "\n".join(lines).encode("utf-8")


def _extract_text_from_anthropic_sse(raw: bytes) -> str:
    """Extract text content from Anthropic SSE stream bytes."""
    text_parts = []
    for line in raw.decode(errors="replace").split("\n"):
        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                if data.get("type") == "content_block_delta":
                    delta = data.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text_parts.append(delta.get("text", ""))
            except (json.JSONDecodeError, KeyError):
                pass
    return "".join(text_parts)


def _sse_to_full_response(raw: bytes, fallback_model: str = "roundtable") -> dict:
    """Reconstruct a complete non-streaming Anthropic Messages response
    from accumulated SSE bytes (data: {...}\\n\\n events).

    Pulls text from content_block_delta events, input_tokens from
    message_start, output_tokens/stop_reason from message_delta — mirroring
    exactly what the real Anthropic API returns for a non-streamed call.
    """
    text_parts = []
    msg_id = f"msg_rt_{id(raw)}"
    model = fallback_model
    stop_reason = "end_turn"
    input_tokens = 0
    output_tokens = 0

    for line in raw.decode(errors="replace").split("\n"):
        if not line.startswith("data:"):
            continue
        try:
            data = json.loads(line[5:].strip())
        except json.JSONDecodeError:
            continue

        etype = data.get("type")
        if etype == "message_start":
            msg = data.get("message", {})
            msg_id = msg.get("id", msg_id)
            model = msg.get("model", model)
            usage = msg.get("usage", {})
            input_tokens = usage.get("input_tokens", input_tokens)
            output_tokens = usage.get("output_tokens", output_tokens)
        elif etype == "content_block_delta":
            delta = data.get("delta", {})
            if delta.get("type") == "text_delta":
                text_parts.append(delta.get("text", ""))
        elif etype == "message_delta":
            delta = data.get("delta", {})
            stop_reason = delta.get("stop_reason", stop_reason)
            usage = data.get("usage", {})
            if "output_tokens" in usage:
                output_tokens = usage["output_tokens"]
            if "input_tokens" in usage:
                input_tokens = usage["input_tokens"]

    text = "".join(text_parts)
    # Fallback: raw wasn't SSE at all (e.g. already a plain JSON blob) —
    # caller handles that case before reaching here, but guard anyway.
    if not text_parts and not input_tokens and not output_tokens:
        output_tokens = max(len(text) // 4, 1)

    return {
        "id": msg_id,
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason,
        "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
    }


def _is_model_validation_request(request_body: dict) -> bool:
    """Détecte une requête de validation de modèle (type `/model roundtable`).

    Claude Code envoie un message minimal pour vérifier qu'un modèle répond :
    - messages très court (<500 chars)
    - max_tokens bas (<=100, parfois 1)
    - pas de tools
    - system prompt quelconque (peut être long en session réelle)
    - pas de conversation multi-tour (≤2 messages)
    Dans ce cas, inutile de lancer la vraie roundtable (4 appels API) —
    on répond immédiatement avec une validation factice.
    """
    msgs = request_body.get("messages", [])
    if not msgs:
        return False
    total_chars = sum(len(str(m.get("content", ""))) for m in msgs)
    max_tokens = request_body.get("max_tokens", 0) or 0
    tools = request_body.get("tools", [])
    msg_count = len(msgs)
    # Validation request = court, pas d'outils, max_tokens raisonnable,
    # conversation courte (pas un vrai prompt utilisateur)
    return (
        total_chars < 500
        and max_tokens <= 100
        and len(tools) == 0
        and msg_count <= 2
    )


def _error_bytes(message: str) -> bytes:
    payload = json.dumps({
        "type": "error",
        "error": {"type": "api_error", "message": message},
    })
    return f"event: error\ndata: {payload}\n\n".encode("utf-8")


# ── Endpoints ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "providers": list(_providers.keys()),
        "models": len(_cfg.get("models", {})),
    }


@app.post("/v1/messages")
async def messages(request: Request):
    """Anthropic-compatible Messages API endpoint."""
    try:
        request_body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    model = request_body.get("model", "")
    streaming = request_body.get("stream", True)

    logger.info(f"[api] /v1/messages model={model} stream={streaming}")

    # Detect roundtable
    rt_cfg = _get_roundtable_config(request_body)
    if rt_cfg:
        logger.info(f"[api] Roundtable activée: {rt_cfg.get('description', '?')}")

        # Fast-path pour validation de modèle (ex: `/model roundtable`) :
        # si la requête est un test court sans vrai contenu utilisateur,
        # on répond immédiatement sans lancer les N appels API réels.
        if _is_model_validation_request(request_body):
            logger.info("[api] Roundtable en mode validation — réponse immédiate (fast-path)")
            validation = {
                "id": f"msg_roundtable_valid_{id(request_body)}",
                "type": "message",
                "role": "assistant",
                "model": "roundtable",
                "content": [{"type": "text", "text": "roundtable model available"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 1, "output_tokens": 3},
            }
            if streaming:
                # Return SSE-wrapped so Claude Code's streaming client parses it correctly.
                sse_bytes = _json_response_as_sse(validation)

                async def _validation_sse():
                    yield sse_bytes

                return StreamingResponse(
                    _validation_sse(),
                    media_type="text/event-stream",
                    headers={"x-routeur-mode": "roundtable-validation"},
                )
            return validation

        if streaming:
            return StreamingResponse(
                _roundtable_stream_with_keepalive(request_body, rt_cfg),
                media_type="text/event-stream",
                headers={"x-routeur-mode": "roundtable"},
            )
        raw = await _run_roundtable(request_body, rt_cfg)
        return _bytes_to_json_response(raw, fallback_model=model or "roundtable")

    # Normal routing
    if not _router:
        raise HTTPException(status_code=500, detail="Router not initialized")

    provider_name, provider_model, model_entry = _router.resolve(request_body)
    provider = _providers.get(provider_name)
    if not provider:
        raise HTTPException(
            status_code=503,
            detail=f"Provider '{provider_name}' not available (missing API key?)",
        )

    # Forward anthropic-beta header (context management, etc.)
    extra_headers = {}
    if "anthropic-beta" in request.headers:
        extra_headers["anthropic-beta"] = request.headers["anthropic-beta"]

    async def _stream_or_error() -> AsyncGenerator[bytes, None]:
        """Yield provider SSE chunks, or an error event on failure/empty.

        Without this guard an empty provider response (rare but possible
        with DeepSeek) produces a 200 with zero bytes — which Claude
        Code's SDK reports as "API returned an empty or malformed response
        (HTTP 200)".
        """
        empty = True
        try:
            async for chunk in provider.stream(request_body, provider_model, extra_headers=extra_headers):
                empty = False
                yield chunk
        except Exception as e:
            logger.error(f"[api] Stream error: {e}")
            yield _error_bytes(str(e))
            empty = False

        if empty:
            logger.error(f"[api] Provider '{provider_name}' returned empty response for model '{provider_model}'")
            yield _error_bytes(
                f"Provider '{provider_name}' returned an empty response for '{provider_model}'"
            )

    if streaming:
        return StreamingResponse(
            _stream_or_error(),
            media_type="text/event-stream",
            headers={
                "x-routeur-provider": provider_name,
                "x-routeur-model": provider_model,
            },
        )

    # Non-streaming: collect SSE chunks and serve as a plain JSON response
    # (matching what Claude Code's SDK expects when stream=false).
    chunks = [chunk async for chunk in _stream_or_error()]
    raw = b"".join(chunks)
    # Check if the result is already an error JSON (e.g. provider error)
    try:
        obj = json.loads(raw.decode(errors="replace"))
        if obj.get("type") == "error":
            return obj
    except json.JSONDecodeError:
        pass
    return _bytes_to_json_response(raw, fallback_model=model or provider_model)


async def _roundtable_stream_with_keepalive(request_body: dict, rt_cfg: dict):
    """Stream roundtable results with immediate keep-alive pings.

    _run_roundtable can take several seconds (fan-out to N analysts +
    arbitration) with zero bytes sent to the client in the meantime.
    A client with a short timeout for a lightweight validation call
    (e.g. Claude Code's `/model` check) can give up and disconnect
    before anything arrives, leaving it with no usable response at
    all. Sending an SSE ping immediately, and periodically while we
    wait, keeps the connection alive and gives near-instant TTFB.
    """
    task = asyncio.create_task(_run_roundtable(request_body, rt_cfg))
    # Immediate byte so the client sees the connection is alive right away.
    # Anthropic's SSE protocol uses comments (": ping") for keepalive, NOT
    # custom event types — a non-standard "event: ping" can confuse strict
    # SSE parsers (including Claude Code's).
    yield b": ping\n\n"
    while True:
        done, _pending = await asyncio.wait({task}, timeout=1.0)
        if task in done:
            yield task.result()
            return
        yield b": ping\n\n"


def _bytes_to_json_response(data: bytes, fallback_model: str = "roundtable"):
    """Convert bytes to a complete non-streaming JSON response.

    `data` can be either:
      - a single JSON object already (e.g. from _format_debate_response), or
      - accumulated SSE bytes forwarded from a real provider stream
        (e.g. from _synthesize_roundtable / a plain provider call).
    Both cases must end up with a valid Anthropic-shaped response
    including a `usage` object, or Claude Code's schema validation
    (z.usage.input_tokens) breaks.
    """
    try:
        obj = json.loads(data.decode(errors="replace"))
        if "usage" not in obj:
            obj["usage"] = {"input_tokens": 0, "output_tokens": 0}
        return obj
    except json.JSONDecodeError:
        # Not plain JSON — assume it's an accumulated SSE stream and
        # reconstruct a proper response (including usage) from it.
        return _sse_to_full_response(data, fallback_model=fallback_model)


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Claude Code Model Router")
    parser.add_argument("--port", type=int, default=None, help="Port (default: from config.yaml or 8787)")
    parser.add_argument("--host", default=None, help="Host (default: from config.yaml or 127.0.0.1)")
    parser.add_argument("--check", action="store_true", help="Validate config and exit")
    parser.add_argument("--log-level", default=None, help="Log level (debug/info/warning/error)")
    args = parser.parse_args()

    # Early config load for --check
    cfg = load_config()
    sv = cfg.get("server", {})

    if args.log_level:
        logging.getLogger().setLevel(getattr(logging, args.log_level.upper(), logging.INFO))

    providers = init_providers(cfg)
    router = Router(cfg)

    if args.check:
        print(f"✓ Config OK: {len(cfg.get('models', {}))} modèles, {len(providers)} providers disponibles")
        for name, p in providers.items():
            print(f"  • {name} → {p.label} ({p.base_url})")
        sys.exit(0)

    host = args.host or sv.get("host", "127.0.0.1")
    port = args.port or sv.get("port", 8787)

    import uvicorn
    logger.info(f"Démarrage sur http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level=sv.get("log_level", "info"))


if __name__ == "__main__":
    main()
