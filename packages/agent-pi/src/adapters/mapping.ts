import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { Option, Schema } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { messageEvents } from "#adapters/messageEvents.ts";

export function rawOf(kind: string, payload: unknown) {
	return { kind, payload: JSON.stringify(payload), source: "pi" };
}
const decodeOutput = Schema.decodeUnknownOption(
	Schema.Struct({ content: Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String), type: Schema.String })) }),
);

export function makeEventMapper() {
	let ending: "completed" | "failed" | "interrupted" = "completed";
	return (event: AgentSessionEvent): RunEvent[] => {
		const raw = rawOf(event.type, event);
		switch (event.type) {
			case "agent_start":
				ending = "completed";
				return [{ raw, state: "running", type: "execution" }];
			case "agent_end": {
				if (event.willRetry) {
					return [{ raw, type: "raw" }];
				}
				const assistant = event.messages.filter((message) => message.role === "assistant").at(-1);
				ending = endState(assistant?.stopReason);
				return [{ raw, type: "raw" }];
			}
			case "agent_settled":
				return [{ raw, state: event.aborted ? "interrupted" : ending, type: "execution" }];
			case "message_end":
				return messageEvents(event.message, raw);
			case "tool_execution_start":
				return [{ input: JSON.stringify(event.args), name: event.toolName, raw, toolId: event.toolCallId, type: "tool.started" }];
			case "tool_execution_end": {
				const output = Option.match(decodeOutput(event.result), {
					onNone: () => "",
					onSome: ({ content }) => content.flatMap((part) => (part.type === "text" && part.text !== undefined ? [part.text] : [])).join("\n"),
				});
				return [{ ok: !event.isError, output, raw, toolId: event.toolCallId, type: "tool.completed" }];
			}
			default:
				return [{ raw, type: "raw" }];
		}
	};
}

function endState(reason: string | undefined) {
	if (reason === "aborted") {
		return "interrupted";
	}
	if (reason === "error") {
		return "failed";
	}
	return "completed";
}
