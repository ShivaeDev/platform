import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

type Message = Extract<
	AgentSessionEvent,
	{
		type: "message_end";
	}
>["message"];
type Assistant = Extract<
	Message,
	{
		role: "assistant";
	}
>;
export function assistant(stopReason: Assistant["stopReason"] = "stop"): Assistant {
	return {
		api: "anthropic-messages",
		content: [
			{ thinking: "Consider the API", type: "thinking" },
			{ text: "App is ready", type: "text" },
		],
		model: "sonnet",
		provider: "anthropic",
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
export function ended(stopReason: Assistant["stopReason"] = "stop", willRetry = false): AgentSessionEvent {
	return {
		messages: [assistant(stopReason)],
		type: "agent_end",
		willRetry,
	};
}
