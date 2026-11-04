import type { Raw } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof Raw.Type;
export function rawOf(kind: string, payload: unknown): RawPayload {
	return {
		kind,
		payload: JSON.stringify(payload),
		source: "opencode",
	};
}
export function rawEvent(raw: RawPayload): AgentEvent[] {
	return [{ raw, type: "raw" }];
}
