import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { Option, Schema } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { messageEvents } from "./messageEvents.ts";

const output = Schema.decodeUnknownOption(
	Schema.Struct({
		content: Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String), type: Schema.String })),
	}),
);
export function rawOf(kind: string, payload: unknown) {
	return { kind, payload: JSON.stringify(payload), source: "pi" };
}
function terminalState(reason: string | undefined): "completed" | "failed" | "interrupted" {
	if (reason === "aborted") {
		return "interrupted";
	}
	return reason === "error" ? "failed" : "completed";
}
export function toAgentEvents(event: AgentSessionEvent): RunEvent[] {
	const raw = rawOf(event.type, event);
	switch (event.type) {
		case "agent_start":
			return [{ raw, state: "running", type: "execution" }];
		case "agent_end": {
			if (event.willRetry) {
				return [{ raw, type: "raw" }];
			}
			const ending = event.messages.filter((message) => message.role === "assistant").at(-1);
			const state = terminalState(ending?.stopReason);
			return [{ raw, state, type: "execution" }];
		}
		case "message_end":
			return messageEvents(event.message, raw);
		case "tool_execution_start":
			return [
				{
					input: JSON.stringify(event.args),
					name: event.toolName,
					providerName: event.toolName,
					raw,
					toolId: event.toolCallId,
					type: "tool.started",
				},
			];
		case "tool_execution_end":
			return [
				{
					ok: !event.isError,
					output: Option.match(output(event.result), {
						onNone: () => "",
						onSome: ({ content }) => content.flatMap((part) => (part.type === "text" && part.text !== undefined ? [part.text] : [])).join("\n"),
					}),
					raw,
					toolId: event.toolCallId,
					type: "tool.completed",
				},
			];
		default:
			return [{ raw, type: "raw" }];
	}
}
