import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { RunEvent } from "@shivaedev/agent/events.ts";

type Message = Extract<
	AgentSessionEvent,
	{
		type: "message_end";
	}
>["message"];
type Raw = NonNullable<RunEvent["raw"]>;
export function messageEvents(message: Message, raw: Raw): RunEvent[] {
	if (message.role === "assistant") {
		const text = message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const thinking = message.content.flatMap((part) => (part.type === "thinking" ? [part.thinking] : [])).join("\n");
		return [
			...(thinking === "" ? [] : [{ raw, text: thinking, type: "thinking" } as const]),
			...(text === "" ? [] : [{ parts: [{ text, type: "text" }], raw, role: "agent", type: "message" } as const]),
			{
				cacheReadTokens: message.usage.cacheRead,
				cacheWriteTokens: message.usage.cacheWrite,
				inputTokens: message.usage.input,
				model: message.model,
				outputTokens: message.usage.output,
				raw,
				scope: "delta",
				type: "usage",
				unit: "turn",
			},
			{
				amount: message.usage.cost.total,
				currency: "USD",
				model: message.model,
				raw,
				scope: "delta",
				source: "provider",
				type: "cost",
				unit: "turn",
			},
		];
	}
	if (message.role === "user") {
		const text =
			typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		return [{ parts: [{ text, type: "text" }], raw, role: "user", type: "message" }];
	}
	return [{ raw, type: "raw" }];
}
