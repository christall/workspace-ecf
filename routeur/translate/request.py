"""Anthropic Messages API → OpenAI Chat Completions API translation."""
from __future__ import annotations
import json
import logging

logger = logging.getLogger(__name__)


def _flatten_content_blocks(content) -> str:
    """Convert Anthropic content blocks to a flat string for OpenAI."""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content)
    parts = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict):
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                # Inject tool call as structured text so the model sees it
                name = block.get("name", "unknown")
                inp = json.dumps(block.get("input", {}), ensure_ascii=False)
                parts.append(f"[tool_use id={block.get('id','')} name={name}] {inp}")
            elif block.get("type") == "tool_result":
                result = block.get("content", "")
                if isinstance(result, list):
                    result = " ".join(
                        b.get("text", "") for b in result if isinstance(b, dict) and b.get("type") == "text"
                    )
                parts.append(f"[tool_result id={block.get('tool_use_id','')}] {result}")
            elif block.get("type") == "thinking":
                # Skip thinking blocks — OpenAI doesn't support them
                continue
    return "\n".join(parts)


def _extract_system_prompt(body: dict) -> str | None:
    """Extract system prompt from Anthropic request (string or array)."""
    system = body.get("system")
    if system is None:
        return None
    if isinstance(system, str):
        return system
    if isinstance(system, list):
        texts = []
        for block in system:
            if isinstance(block, dict):
                t = block.get("text", "")
            elif isinstance(block, str):
                t = block
            else:
                continue
            texts.append(t)
        return "\n".join(texts)
    return str(system)


def anthropic_to_openai(request_body: dict, provider_model: str) -> dict:
    """
    Translate an Anthropic Messages API request to an OpenAI Chat Completions request.

    Key differences handled:
    - System prompt: Anthropic top-level → OpenAI role:"system" message
    - Content: Anthropic blocks → OpenAI string
    - Tools: Anthropic {name, description, input_schema} → OpenAI {type:"function", function:{...}}
    - Streaming: same boolean
    """
    messages: list[dict] = []

    # System → first message
    system_text = _extract_system_prompt(request_body)
    if system_text:
        messages.append({"role": "system", "content": system_text})

    # Messages — track tool_call_ids for tool results
    pending_tool_calls: dict[int, dict] = {}  # index → {id, name}

    for msg in request_body.get("messages", []):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "assistant":
            # Check for tool_use blocks
            text_parts = []
            tool_calls = []
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        tc_id = block.get("id", f"call_{len(tool_calls)}")
                        tool_calls.append({
                            "id": tc_id,
                            "type": "function",
                            "function": {
                                "name": block.get("name", ""),
                                "arguments": json.dumps(block.get("input", {}), ensure_ascii=False),
                            },
                        })
                    elif isinstance(block, dict) and block.get("type") == "thinking":
                        continue  # Skip thinking in assistant messages too
                    elif isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        text_parts.append(block)

            if tool_calls:
                entry: dict = {"role": "assistant", "content": "\n".join(text_parts) if text_parts else None}
                entry["tool_calls"] = tool_calls
                messages.append(entry)
            else:
                messages.append({"role": "assistant", "content": "\n".join(text_parts) if text_parts else ""})

        elif role == "user":
            # Check for tool_result blocks
            if isinstance(content, list):
                has_tool_results = any(
                    isinstance(b, dict) and b.get("type") == "tool_result" for b in content
                )
                if has_tool_results:
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_result":
                            result_content = block.get("content", "")
                            if isinstance(result_content, list):
                                result_content = " ".join(
                                    b.get("text", "") for b in result_content
                                    if isinstance(b, dict) and b.get("type") == "text"
                                )
                            messages.append({
                                "role": "tool",
                                "tool_call_id": block.get("tool_use_id", ""),
                                "content": result_content,
                            })
                    continue
            # Normal user message
            text = _flatten_content_blocks(content)
            messages.append({"role": "user", "content": text})

        else:
            # Generic — treat as user
            text = _flatten_content_blocks(content)
            messages.append({"role": "user", "content": text})

    # Tools translation
    tools = None
    anthropic_tools = request_body.get("tools", [])
    if anthropic_tools:
        tools = []
        for tool in anthropic_tools:
            tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {}),
                },
            })

    # Build OpenAI request
    oai: dict = {
        "model": provider_model,
        "messages": messages,
    }

    max_tokens = request_body.get("max_tokens", 4096)
    if max_tokens:
        oai["max_tokens"] = max_tokens

    if tools:
        oai["tools"] = tools
        # If tool_choice is specified
        tc = request_body.get("tool_choice")
        if tc:
            if isinstance(tc, dict) and tc.get("type") == "auto":
                oai["tool_choice"] = "auto"
            elif isinstance(tc, dict) and tc.get("type") == "any":
                oai["tool_choice"] = "required"
            elif isinstance(tc, dict) and tc.get("type") == "tool":
                oai["tool_choice"] = {"type": "function", "function": {"name": tc.get("name", "")}}

    if request_body.get("temperature") is not None:
        oai["temperature"] = request_body["temperature"]

    # top_p, top_k — map what we can
    if "top_p" in request_body:
        oai["top_p"] = request_body["top_p"]

    streaming = request_body.get("stream", True)
    oai["stream"] = streaming
    if streaming:
        oai["stream_options"] = {"include_usage": True}

    logger.debug(
        f"Translated: Anthropic {len(request_body.get('messages',[]))} msgs, "
        f"{len(anthropic_tools)} tools → OpenAI {len(messages)} msgs, "
        f"{len(tools or [])} tools"
    )

    return oai
