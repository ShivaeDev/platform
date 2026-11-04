import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { RunEvent } from "@shivaedev/agent/events.ts";

type PiMessage = Extract<AgentSessionEvent, { type: "message_end" }>["message"];
type Raw = NonNullable<RunEvent["raw"]>;

export function messageEvents(message: PiMessage, raw: Raw): RunEvent[] {
	if (message.role === "user") {
		const text =
			typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		return [{ parts: [{ text, type: "text" }], raw, role: "user", type: "message" }];
	}
	if (message.role !== "assistant") {
		return [{ raw, type: "raw" }];
	}
	const events: RunEvent[] = [];
	const thinking = message.content.flatMap((part) => (part.type === "thinking" ? [part.thinking] : [])).join("\n");
	const text = message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
	if (thinking !== "") {
		events.push({ raw, text: thinking, type: "thinking" });
	}
	if (text !== "") {
		events.push({ parts: [{ text, type: "text" }], raw, role: "agent", type: "message" });
	}
	const model = `${message.provider}/${message.model}`;
	events.push(
		{
			cacheReadTokens: message.usage.cacheRead,
			cacheWriteTokens: message.usage.cacheWrite,
			inputTokens: message.usage.input,
			model,
			outputTokens: message.usage.output,
			raw,
			scope: "delta",
			type: "usage",
			unit: "turn",
		},
		{
			amount: message.usage.cost.total,
			currency: "USD",
			model,
			raw,
			scope: "delta",
			source: "provider",
			type: "cost",
			unit: "turn",
		},
	);
	return events;
}
