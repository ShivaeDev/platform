import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { NATIVE_SESSION, stamp } from "#test/frames.ts";
export function result(tokens: number, terminalReason?: "aborted_streaming"): SDKMessage {
	return {
		"duration_api_ms": 1,
		"duration_ms": 1,
		"is_error": terminalReason !== undefined,
		modelUsage: {
			alias: {
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
				canonicalModel: "claude-sonnet",
				contextWindow: 200_000,
				"costUSD": tokens / 100,
				inputTokens: tokens,
				maxOutputTokens: 32_000,
				outputTokens: tokens,
				webSearchRequests: 0,
			},
		},
		"num_turns": 1,
		"permission_denials": [],
		result: "Done",
		"session_id": NATIVE_SESSION,
		"stop_reason": "end_turn",
		subtype: "success",
		"total_cost_usd": tokens / 100,
		type: "result",
		usage: {
			"cache_creation": { "ephemeral_1h_input_tokens": 0, "ephemeral_5m_input_tokens": 0 },
			"cache_creation_input_tokens": 0,
			"cache_read_input_tokens": 0,
			"fallback_credit": { status: { reason: "not_enabled", type: "not_applied" } },
			"inference_geo": "us",
			"input_tokens": tokens,
			iterations: [],
			"output_tokens": tokens,
			"output_tokens_details": { "thinking_tokens": 0 },
			"server_tool_use": { "web_fetch_requests": 0, "web_search_requests": 0 },
			"service_tier": "standard",
			speed: "standard",
		},
		uuid: stamp(),
		...(terminalReason === undefined ? {} : { "terminal_reason": terminalReason }),
	};
}
