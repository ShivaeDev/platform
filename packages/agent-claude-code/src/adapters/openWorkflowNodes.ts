import type { RunEvent } from "@shivaedev/agent/events.ts";
import { type WorkflowAgentRef, workflowRunRef } from "#adapters/mirrorKeys.ts";
import { claudeRaw } from "#adapters/rawPayload.ts";
import type { WorkflowIdentities, WorkflowIdentity } from "#adapters/workflowIdentity.ts";
import type { Origin } from "#protocol.ts";

interface NodeState {
	named: boolean;
	settled: boolean;
}
interface WorkflowNodes {
	readonly known: (agentId: string) => boolean;
	readonly opened: (ref: WorkflowAgentRef) => readonly RunEvent[];
	readonly originOf: (ref: WorkflowAgentRef) => Origin;
	readonly settled: () => readonly RunEvent[];
}
function openedEvent(ref: WorkflowAgentRef, identity: WorkflowIdentity | undefined, spawnedBy: string): RunEvent {
	return {
		...(identity?.label === undefined ? {} : { label: identity.label }),
		childRef: ref.agentId,
		raw: claudeRaw("workflow/agent", { ...ref, ...identity }),
		spawnedBy,
		type: "child.opened",
	};
}
export function openWorkflowNodes(identities: WorkflowIdentities): WorkflowNodes {
	const nodes = new Map<string, NodeState>();
	function spawnerOf(ref: WorkflowAgentRef): string {
		return identities.of(ref.agentId)?.spawnedBy ?? workflowRunRef(ref.runId);
	}
	function opened(ref: WorkflowAgentRef): readonly RunEvent[] {
		const identity = identities.of(ref.agentId);
		const state = nodes.get(ref.agentId);
		if (state === undefined) {
			nodes.set(ref.agentId, {
				named: identity?.label !== undefined,
				settled: false,
			});
			return [openedEvent(ref, identity, spawnerOf(ref))];
		}
		if (state.named || identity?.label === undefined) {
			return [];
		}
		state.named = true;
		return [openedEvent(ref, identity, spawnerOf(ref))];
	}
	function settled(): readonly RunEvent[] {
		return [...nodes].flatMap(([agentId, state]) => {
			const ending = identities.of(agentId)?.ended;
			if (state.settled || ending === undefined) {
				return [];
			}
			state.settled = true;
			return [
				{
					childRef: agentId,
					outcome: ending,
					raw: claudeRaw("workflow/agent-ended", {
						agentId,
						...identities.of(agentId),
					}),
					type: "child.ended",
				} satisfies RunEvent,
			];
		});
	}
	return {
		known: (agentId) => nodes.has(agentId),
		opened,
		originOf: (ref) => ({ node: ref.agentId, spawnedBy: spawnerOf(ref) }),
		settled,
	};
}
