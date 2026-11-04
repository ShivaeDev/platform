import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { isRecord, textOf } from "#adapters/blocks.ts";
import type { ChildOutcome, RawPayload } from "#protocol.ts";

type SystemMessage = Extract<
	SDKMessage,
	{
		type: "system";
	}
>;
type TaskUpdated = Extract<
	SystemMessage,
	{
		subtype: "task_updated";
	}
>;
type TaskNotification = Extract<
	SystemMessage,
	{
		subtype: "task_notification";
	}
>;
export interface Ending {
	readonly childRef: string;
	readonly outcome: ChildOutcome;
	readonly summary: string | undefined;
}
export function endedEvent(raw: RawPayload, ending: Ending): RunEvent {
	return {
		childRef: ending.childRef,
		outcome: ending.outcome,
		raw,
		...(ending.summary === undefined ? {} : { summary: ending.summary }),
		type: "child.ended",
	};
}
const LIVE = new Set(["paused", "pending", "running"]);
function patchedOutcome(status: string): ChildOutcome {
	if (status === "completed") {
		return "completed";
	}
	if (status === "failed") {
		return "failed";
	}
	return status === "killed" ? "interrupted" : "unknown";
}
// Claude emits no task-completed frame; the first patch outside the live states is terminal.
export function updatedEnding(message: TaskUpdated): Ending | undefined {
	const status = message.patch.status;
	if (status === undefined || LIVE.has(status)) {
		return undefined;
	}
	return {
		childRef: message.task_id,
		outcome: patchedOutcome(status),
		summary: undefined,
	};
}
export function notifiedEnding(message: TaskNotification): Ending {
	return {
		childRef: message.task_id,
		outcome: message.status === "stopped" ? "interrupted" : message.status,
		summary: message.summary,
	};
}
export function reportedEnding(message: SDKMessage): Ending | undefined {
	if (!("tool_use_result" in message && isRecord(message.tool_use_result))) {
		return undefined;
	}
	const output = message.tool_use_result;
	if (output.status !== "completed" || typeof output.agentId !== "string") {
		return undefined;
	}
	return {
		childRef: output.agentId,
		outcome: "completed",
		summary: Array.isArray(output.content) ? textOf(output.content) : undefined,
	};
}
