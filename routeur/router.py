"""Routing logic — selects provider+model from an incoming Anthropic request."""
from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class Router:
    """Decide which provider and model to use for a given request."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.models: dict[str, dict] = cfg.get("models", {})
        self.routing = cfg.get("routing", {})
        self.default_model = self.routing.get("default_model", "deepseek-v4-pro")

    def resolve(self, request_body: dict, _depth: int = 0) -> tuple[str, str, dict]:
        """
        Return (provider_name, provider_model, model_entry).

        Special model names:
        - "auto" / "smart" → smart routing based on prompt complexity
        - "roundtable" → handled upstream (by main.py)
        - Actual model name → direct lookup
        - Unknown model → fallback to default

        `_depth` guards against any circular fallback/fuzzy-match config
        (e.g. default_model resolving back to something invalid) causing
        infinite recursion and a RecursionError/500 — fail loudly instead.
        """
        if _depth > 3:
            raise ValueError(
                f"[router] Boucle de résolution détectée pour "
                f"'{request_body.get('model')}' (profondeur > 3) — "
                f"vérifie routing.default_model et config.yaml → models."
            )
        model_requested = request_body.get("model", "").strip()

        # --- Smart routing ---
        if model_requested in ("auto", "smart"):
            return self._smart_route(request_body, _depth=_depth)

        # --- Direct lookup ---
        entry = self.models.get(model_requested)
        if entry:
            provider = entry["provider"]
            provider_model = entry.get("provider_model", model_requested)
            logger.info(
                f"[router] {model_requested} → {provider}/{provider_model} "
                f"(tier={entry.get('tier', '?')})"
            )
            return provider, provider_model, entry

        # --- Unknown model — attempt heuristic ---
        # If the model name contains a provider hint, try to resolve
        for name, entry in self.models.items():
            if name in model_requested or model_requested in name:
                logger.info(f"[router] Fuzzy match: {model_requested} → {name}")
                return entry["provider"], entry.get("provider_model", name), entry

        # --- Absolute fallback ---
        if model_requested == self.default_model:
            # default_model itself isn't in self.models (or fuzzy-matched) —
            # recursing again would loop forever. Fail loudly instead.
            raise ValueError(
                f"[router] default_model '{self.default_model}' n'est pas un "
                f"modèle valide dans config.yaml (aucune entrée dans 'models')."
            )
        logger.warning(
            f"[router] Unknown model '{model_requested}', "
            f"falling back to {self.default_model}"
        )
        # NOTE: "model" must come AFTER **request_body, otherwise
        # request_body's own "model" key (the invalid one we're falling
        # back from) silently overwrites default_model and this recurses
        # forever with the exact same input.
        return self.resolve({**request_body, "model": self.default_model}, _depth=_depth + 1)

    def _smart_route(self, request_body: dict, _depth: int = 0) -> tuple[str, str, dict]:
        """Analyze prompt complexity and pick the best model tier."""
        smart_cfg = self.routing.get("smart", {})
        tiers = self.routing.get("tiers", {})

        # Heuristic 1: total input size
        messages = request_body.get("messages", [])
        total_chars = sum(
            len(str(m.get("content", ""))) for m in messages
        )
        system_chars = len(str(request_body.get("system", "")))
        total_input = total_chars + system_chars

        simple_max = smart_cfg.get("simple_max_chars", 3000)

        # Heuristic 2: tool count
        tools = request_body.get("tools", [])
        tool_count = len(tools)
        complex_tool_threshold = smart_cfg.get("complex_tool_threshold", 3)

        # Heuristic 3: message count (conversation length)
        msg_count = len(messages)

        # Decision
        tier = smart_cfg.get("default_tier", "sonnet")

        if msg_count <= 2 and total_input < simple_max and tool_count == 0:
            tier = "haiku"
        elif tool_count >= complex_tool_threshold or total_input > 15000:
            tier = "opus"

        # Pick first available model in that tier
        tier_models = tiers.get(tier, {}).get("models", [])
        model_name = tier_models[0] if tier_models else self.default_model

        logger.info(
            f"[router] smart → tier={tier} model={model_name} "
            f"(input={total_input}chars, tools={tool_count}, msgs={msg_count})"
        )

        return self.resolve({**request_body, "model": model_name}, _depth=_depth + 1)

    def get_provider_config(self, provider_name: str) -> dict | None:
        """Return the provider config dict from config.yaml, or None."""
        return self.cfg.get("providers", {}).get(provider_name)

    def get_roundtable(self, name: str) -> dict | None:
        """Return a roundtable preset by name."""
        rts = self.cfg.get("roundtables", {})
        return rts.get(name, rts.get("default"))
