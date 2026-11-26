"""OpenAI SSE stream → Anthropic SSE events translation."""
from __future__ import annotations
import json
import logging
import uuid
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


async def openai_stream_to_anthropic(
    lines: AsyncGenerator[str, None],
    display_model: str,
) -> AsyncGenerator[bytes, None]:
    """
    Consume OpenAI SSE lines, yield Anthropic SSE event bytes.

    OpenAI stream format:
      data: {"id":"...","choices":[{"delta":{"role":"assistant","content":"Hello"},"index":0}]}
      data: {"id":"...","choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"xxx","arguments":"..."}}]},"index":0}]}
      data: {"id":"...","choices":[{"finish_reason":"stop"}], "usage": {...}}
      data: [DONE]

    Anthropic SSE format:
      event: message_start        data: {"type":"message_start","message":{...}}
      event: content_block_start  data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
      event: content_block_delta  data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
      event: content_block_stop   data: {"type":"content_block_stop","index":0}
      event: message_delta        data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{...}}
      event: message_stop         data: {"type":"message_stop"}
    """
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"
    started = False
    text_block_index = 0
    current_tool_calls: dict[int, dict] = {}  # index → {id, name, arguments}
    next_tool_index = 1  # for content block indices
    finish_reason = "end_turn"
    usage = {"input_tokens": 0, "output_tokens": 0}
    sent_content_block_stop = set()  # indices we've closed

    async for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if not line.startswith("data:"):
            continue
        data_str = line[5:].strip()
        if data_str == "[DONE]":
            break

        try:
            chunk = json.loads(data_str)
        except json.JSONDecodeError:
            logger.debug(f"Skip unparseable SSE: {data_str[:100]}")
            continue

        # OpenAI peut émettre data: null ou des chunks mal-formés —
        # les ignorer proprement évite un crash NoneType dans le streaming.
        if chunk is None:
            logger.debug(f"Skip null SSE chunk: {data_str[:100]}")
            continue

        choices = chunk.get("choices", [])
        if not choices:
            continue

        choice = choices[0]
        if choice is None:
            logger.debug(f"Skip SSE with null choice: {data_str[:100]}")
            continue

        try:
            delta = choice.get("delta", {})
            finish = choice.get("finish_reason") or choice.get("finish_details")

            # --- Track usage ---
            if "usage" in chunk:
                u = chunk["usage"]
                if u is not None:
                    usage["input_tokens"] = u.get("prompt_tokens", usage["input_tokens"])
                    usage["output_tokens"] = u.get("completion_tokens", usage["output_tokens"])

            # --- Handle tool calls ---
            tool_calls_delta = delta.get("tool_calls", [])
            if tool_calls_delta:
                for tc in tool_calls_delta:
                    idx = tc.get("index", 0)
                    if idx not in current_tool_calls:
                        current_tool_calls[idx] = {
                            "id": tc.get("id", f"tcu_{uuid.uuid4().hex[:16]}"),
                            "name": "",
                            "arguments": "",
                        }
                        if text_block_index not in sent_content_block_stop:
                            yield _sse("content_block_stop", {
                                "type": "content_block_stop",
                                "index": text_block_index,
                            })
                            sent_content_block_stop.add(text_block_index)

                        tb_idx = text_block_index + 1 + idx
                        yield _sse("content_block_start", {
                            "type": "content_block_start",
                            "index": tb_idx,
                            "content_block": {
                                "type": "tool_use",
                                "id": current_tool_calls[idx]["id"],
                                "name": "",
                                "input": {},
                            },
                        })

                    entry = current_tool_calls[idx]
                    if tc.get("function", {}).get("name"):
                        entry["name"] = tc["function"]["name"]
                    if tc.get("function", {}).get("arguments"):
                        entry["arguments"] += tc["function"]["arguments"]

                    tb_idx = text_block_index + 1 + idx
                    yield _sse("content_block_delta", {
                        "type": "content_block_delta",
                        "index": tb_idx,
                        "delta": {
                            "type": "input_json_delta",
                            "partial_json": tc.get("function", {}).get("arguments", ""),
                        },
                    })
                continue

            # --- Handle text delta ---
            text = delta.get("content", "")
            if text:
                if not started:
                    started = True
                    yield _sse("message_start", {
                        "type": "message_start",
                        "message": {
                            "id": msg_id,
                            "type": "message",
                            "role": "assistant",
                            "content": [],
                            "model": display_model,
                            "stop_reason": None,
                            "stop_sequence": None,
                            "usage": {"input_tokens": 0, "output_tokens": 0},
                        },
                    })
                    yield _sse("content_block_start", {
                        "type": "content_block_start",
                        "index": text_block_index,
                        "content_block": {"type": "text", "text": ""},
                    })

                yield _sse("content_block_delta", {
                    "type": "content_block_delta",
                    "index": text_block_index,
                    "delta": {"type": "text_delta", "text": text},
                })

            # --- Handle finish reason ---
            if finish and finish != "none":
                finish_reason = _map_openai_finish(finish)
        except Exception:
            logger.warning(f"Skip malformed SSE chunk: {data_str[:200]}", exc_info=True)
            continue

    # --- Close all open blocks ---
    # Text block
    if text_block_index not in sent_content_block_stop:
        yield _sse("content_block_stop", {
            "type": "content_block_stop",
            "index": text_block_index,
        })
        sent_content_block_stop.add(text_block_index)

    # Tool blocks
    for tc_idx, tc_data in current_tool_calls.items():
        tb_idx = text_block_index + 1 + tc_idx
        if tb_idx not in sent_content_block_stop:
            # Resolve final arguments into input dict
            try:
                parsed_input = json.loads(tc_data["arguments"]) if tc_data["arguments"] else {}
            except json.JSONDecodeError:
                parsed_input = {}

            # Send final delta with complete JSON
            yield _sse("content_block_delta", {
                "type": "content_block_delta",
                "index": tb_idx,
                "delta": {
                    "type": "input_json_delta",
                    "partial_json": tc_data["arguments"],
                },
            })
            yield _sse("content_block_stop", {
                "type": "content_block_stop",
                "index": tb_idx,
            })
            sent_content_block_stop.add(tb_idx)

    # --- message_delta + message_stop ---
    if started or current_tool_calls:
        yield _sse("message_delta", {
            "type": "message_delta",
            "delta": {
                "stop_reason": finish_reason,
                "stop_sequence": None,
            },
            "usage": {
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
            },
        })

    yield _sse("message_stop", {"type": "message_stop"})


def _sse(event: str, data: dict) -> bytes:
    """Format an Anthropic-compatible SSE event."""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


def _map_openai_finish(reason: str) -> str:
    mapping = {
        "stop": "end_turn",
        "length": "max_tokens",
        "tool_calls": "tool_use",
        "function_call": "tool_use",
        "content_filter": "end_turn",
    }
    return mapping.get(reason, "end_turn")
