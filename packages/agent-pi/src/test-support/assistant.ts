import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

type Assistant = Extract<Extract<AgentSessionEvent, { type: "message_end" }>["message"], { role: "assistant" }>;
export function assistant(stopReason: Assistant["stopReason"] = "stop"): Assistant {
	return {
		api: "anthropic-messages",
		content: [
			{ thinking: "weighing it", type: "thinking" },
			{ text: "all done", type: "text" },
		],
		model: "fast",
		provider: "acme",
		role: "assistant",
		stopReason,
		timestamp: 0,
		usage: {
			cacheRead: 3,
			cacheWrite: 1,
			cost: { cacheRead: 0.01, cacheWrite: 0.02, input: 0.03, output: 0.04, total: 0.1 },
			input: 11,
			output: 5,
			totalTokens: 20,
		},
	};
}
