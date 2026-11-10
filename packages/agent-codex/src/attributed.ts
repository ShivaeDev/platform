import type { Origin as OriginSchema } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type Origin = typeof OriginSchema.Type;

export function attributed(event: AgentEvent, origin: Origin): AgentEvent {
	switch (event.type) {
		case "message":
		case "model.changed":
		case "raw":
		case "gap":
		case "thinking":
		case "tool.completed":
		case "tool.started":
		case "execution":
		case "usage":
			return { ...event, origin };
		default:
			return event;
	}
}
