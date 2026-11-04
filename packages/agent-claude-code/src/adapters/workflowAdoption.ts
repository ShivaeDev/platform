import type { SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { agentFileRef } from "#adapters/mirrorKeys.ts";
import { claudeRaw } from "#adapters/rawPayload.ts";
import type { Origin } from "#protocol.ts";
export interface AdoptedAgent {
	readonly agentId: string;
	readonly messages: readonly SessionMessage[];
}
export interface Repair {
	readonly agents: readonly AdoptedAgent[];
	readonly failure: string | undefined;
}
function admissionOrigin(agent: AdoptedAgent): Origin {
	return {
		node: agent.agentId,
		spawnedBy: agent.messages[0]?.parent_tool_use_id ?? agentFileRef(agent.agentId),
	};
}
function adoptedGap(agent: AdoptedAgent, origin: Origin): RunEvent {
	return {
		detail: `this node was read back from its stored transcript after the live record missed it, ${agent.messages.length} messages already written`,
		kind: "adopted-late",
		origin,
		raw: claudeRaw("workflow/adopted-late", { agentId: agent.agentId }),
		type: "gap",
	};
}
function adoptedEnding(agent: AdoptedAgent): RunEvent {
	return {
		childRef: agent.agentId,
		outcome: "unknown",
		raw: claudeRaw("workflow/adopted-late", { agentId: agent.agentId }),
		type: "child.ended",
	};
}
export function censusGap(failure: string): RunEvent {
	return {
		detail: `subagent backfill source unreachable; this session's workflow census could not be checked: ${failure}`,
		kind: "unknown",
		raw: claudeRaw("workflow/census-unreadable", { failure }),
		type: "gap",
	};
}
export function adoptedEvents(agent: AdoptedAgent, recovered: readonly RunEvent[]): readonly RunEvent[] {
	const origin = admissionOrigin(agent);
	return [
		{
			childRef: agent.agentId,
			raw: claudeRaw("workflow/adopted-late", { agentId: agent.agentId }),
			spawnedBy: origin.spawnedBy,
			type: "child.opened",
		},
		adoptedGap(agent, origin),
		...recovered,
		adoptedEnding(agent),
	];
}
