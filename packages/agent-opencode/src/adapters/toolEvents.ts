import type { Raw } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof Raw.Type;

import type { KnownPart } from "#adapters/protocolParts.ts";

type ToolPart = Extract<
	KnownPart,
	{
		type: "tool";
	}
>;
export function toolEvents(raw: RawPayload, part: ToolPart, announce: (callId: string) => boolean): AgentEvent[] {
	const { state } = part;
	if (state.status === "completed" || state.status === "error") {
		if (!announce(part.callID)) {
			return [];
		}
		return [
			{
				ok: state.status === "completed",
				output: state.output ?? state.error ?? "",
				raw,
				toolId: part.callID,
				type: "tool.completed",
			},
		];
	}
	if (state.status === "pending" || !announce(part.callID)) {
		return [];
	}
	return [
		{
			input: JSON.stringify(state.input ?? {}),
			name: part.tool,
			raw,
			toolId: part.callID,
			type: "tool.started",
		},
	];
}
