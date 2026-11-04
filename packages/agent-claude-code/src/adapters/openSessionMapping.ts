import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { blockEvent, contentBlocks } from "#adapters/blocks.ts";
import { openSubsessions } from "#adapters/openSubsessions.ts";
import { openTurnUsage } from "#adapters/openTurnUsage.ts";
import { rateLimitEvent } from "#adapters/rateLimitEvent.ts";
import { rawOf } from "#adapters/rawPayload.ts";
import { spilledPreview } from "#adapters/spilledPreview.ts";
import { systemEvents } from "#adapters/systemEvents.ts";
import type { Origin, RawPayload } from "#protocol.ts";

type ResultMessage = Extract<
	SDKMessage,
	{
		type: "result";
	}
>;
function turnStatus(message: ResultMessage) {
	if (message.terminal_reason === "aborted_streaming") {
		return "interrupted";
	}
	return message.is_error ? "failed" : "completed";
}
function originOf(message: SDKMessage): Origin | undefined {
	const spawnedBy = "parent_tool_use_id" in message && typeof message.parent_tool_use_id === "string" ? message.parent_tool_use_id : undefined;
	if (spawnedBy === undefined) {
		return undefined;
	}
	return "parent_agent_id" in message && typeof message.parent_agent_id === "string"
		? { parentNode: message.parent_agent_id, spawnedBy }
		: { spawnedBy };
}
type ContentMessage = Extract<
	SDKMessage,
	{
		type: "assistant" | "user";
	}
>;
function contentEvents(raw: RawPayload, message: ContentMessage, lifecycle: readonly RunEvent[]): readonly RunEvent[] {
	const role = message.type === "assistant" ? "agent" : "user";
	const origin = originOf(message);
	const events = [
		...contentBlocks(message)
			.map((block) => blockEvent(raw, role, block, origin))
			.filter((event): event is RunEvent => event !== undefined),
		...spilledPreview(raw, message, origin),
		...lifecycle,
	];
	return events.length === 0 ? [{ raw, type: "raw" }] : events;
}
interface SessionMapping {
	readonly frame: (message: SDKMessage) => readonly RunEvent[];
	readonly spawnerOf: (childRef: string) => string | undefined;
}
export function openSessionMapping(): SessionMapping {
	const subsessions = openSubsessions();
	const turns = openTurnUsage();
	function frame(message: SDKMessage): readonly RunEvent[] {
		const raw = rawOf(message);
		const system = message.type === "system" ? systemEvents(raw, message) : undefined;
		if (system !== undefined) {
			return system;
		}
		if (message.type === "rate_limit_event") {
			return [rateLimitEvent(raw, message)];
		}
		if (message.type === "result") {
			return [
				...turns.usage(raw, message),
				{
					raw,
					state: turnStatus(message),
					type: "execution",
				},
			];
		}
		const lifecycle = subsessions.events(raw, message);
		if (message.type === "assistant" || message.type === "user") {
			return contentEvents(raw, message, lifecycle);
		}
		return lifecycle.length === 0 ? [{ raw, type: "raw" }] : lifecycle;
	}
	return { frame, spawnerOf: subsessions.spawnerOf };
}
