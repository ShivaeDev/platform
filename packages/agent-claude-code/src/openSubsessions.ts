import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { RawPayload } from "#protocol.ts";
import { type Ending, endedEvent, notifiedEnding, reportedEnding, updatedEnding } from "#subsessionEndings.ts";

const LOCAL_AGENT = "local_agent";
type SystemMessage = Extract<
	SDKMessage,
	{
		type: "system";
	}
>;
type TaskStarted = Extract<
	SystemMessage,
	{
		subtype: "task_started";
	}
>;
type Opened = Extract<
	RunEvent,
	{
		type: "child.opened";
	}
>;
function openedEvent(raw: RawPayload, message: TaskStarted): Opened | undefined {
	if (message.task_type !== LOCAL_AGENT || message.tool_use_id === undefined) {
		return undefined;
	}
	return {
		...(message.prompt === undefined ? {} : { charter: message.prompt }),
		...(message.description === "" ? {} : { label: message.description }),
		childRef: message.task_id,
		raw,
		spawnedBy: message.tool_use_id,
		type: "child.opened",
	};
}
interface Subsessions {
	readonly events: (raw: RawPayload, message: SDKMessage) => readonly RunEvent[];
	readonly spawnerOf: (childRef: string) => string | undefined;
}
// Task updates and notifications omit `task_type`, so only ids observed opening as `local_agent` can close a subsession.
export function openSubsessions(): Subsessions {
	const open = new Set<string>();
	const spawners = new Map<string, string>();
	function close(raw: RawPayload, ending: Ending | undefined): readonly RunEvent[] {
		return ending === undefined || !open.delete(ending.childRef) ? [] : [endedEvent(raw, ending)];
	}
	return {
		events: (raw, message) => {
			if (message.type !== "system") {
				return close(raw, reportedEnding(message));
			}
			if (message.subtype === "task_started") {
				const opened = openedEvent(raw, message);
				if (opened === undefined) {
					return [];
				}
				open.add(message.task_id);
				spawners.set(message.task_id, opened.spawnedBy);
				return [opened];
			}
			if (message.subtype === "task_updated") {
				return close(raw, updatedEnding(message));
			}
			return message.subtype === "task_notification" ? close(raw, notifiedEnding(message)) : [];
		},
		spawnerOf: (childRef) => spawners.get(childRef),
	};
}
