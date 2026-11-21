import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { RawPayload } from "#protocol.ts";

type StateMessage = Extract<
	SDKMessage,
	{
		subtype: "session_state_changed";
	}
>;
type TasksMessage = Extract<
	SDKMessage,
	{
		subtype: "background_tasks_changed";
	}
>;
const STATE: Record<StateMessage["state"], "running" | "awaiting-input"> = {
	idle: "awaiting-input",
	"requires_action": "awaiting-input",
	running: "running",
};
function stateEvent(raw: RawPayload, message: StateMessage): RunEvent {
	return {
		raw,
		state: STATE[message.state],
		type: "execution",
	};
}
function backgroundEvent(raw: RawPayload, message: TasksMessage): RunEvent {
	return {
		raw,
		tasks: message.tasks.map((task) => ({
			description: task.description,
			id: task.task_id,
			kind: task.task_type,
		})),
		type: "session.background",
	};
}
type SystemMessage = Extract<
	SDKMessage,
	{
		type: "system";
	}
>;
export function systemEvents(raw: RawPayload, message: SystemMessage): readonly RunEvent[] | undefined {
	if (message.subtype === "init") {
		return [{ raw, reference: message.session_id, type: "session.opened" }];
	}
	if (message.subtype === "session_state_changed") {
		return [stateEvent(raw, message)];
	}
	if (message.subtype === "background_tasks_changed") {
		return [backgroundEvent(raw, message)];
	}
	if (message.subtype === "thinking_tokens" || message.subtype === "task_progress") {
		return [];
	}
	return undefined;
}
