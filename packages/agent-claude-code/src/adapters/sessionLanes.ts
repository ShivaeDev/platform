import type { SDKMessage, SessionKey, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { agentFileRef, subagentRef, workflowAgentRef } from "#adapters/mirrorKeys.ts";
import { openSessionMapping } from "#adapters/openSessionMapping.ts";
import { claudeRaw } from "#adapters/rawPayload.ts";
import { transcriptEvents } from "#adapters/transcriptEvents.ts";
import { adoptedEvents, censusGap, type Repair } from "#adapters/workflowAdoption.ts";
import { openWorkflowIdentities } from "#adapters/workflowIdentity.ts";
import { openWorkflowNodes } from "#openWorkflowNodes.ts";
import type { Origin } from "#protocol.ts";
export interface MirrorWrite {
	readonly entries: readonly SessionStoreEntry[];
	readonly key: SessionKey;
}
export type Delivery =
	| {
			readonly kind: "frame";
			readonly message: SDKMessage;
			readonly inputId?: string;
	  }
	| {
			readonly kind: "mirror";
			readonly write: MirrorWrite;
	  }
	| {
			readonly kind: "repair";
			readonly repair: Repair;
	  };
export function openSessionLanes() {
	const mapping = openSessionMapping();
	const identities = openWorkflowIdentities();
	const nodes = openWorkflowNodes(identities);
	const seen = new Set<string>();
	const mirroredOrigins = new Map<string, Origin>();
	function recorded(id: string) {
		return mirroredOrigins.has(id) || nodes.known(id) || mapping.spawnerOf(id) !== undefined;
	}
	function unique(uuid: string | undefined, events: readonly RunEvent[]): readonly RunEvent[] {
		if (uuid === undefined) {
			return events;
		}
		return events.filter((event, index) => {
			if (event.type === "child.opened" || event.type === "child.ended") {
				return true;
			}
			const key = `${uuid}:${event.type}:${index}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}
	function mirrored({ entries, key }: MirrorWrite): readonly RunEvent[] {
		const ref = workflowAgentRef(key);
		const node = subagentRef(key);
		let origin: Origin | undefined;
		if (ref !== undefined) {
			origin = nodes.originOf(ref);
		} else if (node !== undefined) {
			origin = { node, spawnedBy: mapping.spawnerOf(node) ?? agentFileRef(node) };
		}
		const opened: RunEvent[] =
			node !== undefined && ref === undefined && !recorded(node)
				? [{ childRef: node, spawnedBy: origin?.spawnedBy ?? agentFileRef(node), type: "child.opened" }]
				: [];
		if (node !== undefined && origin !== undefined) {
			mirroredOrigins.set(node, origin);
		}
		return [
			...opened,
			...(ref === undefined ? [] : nodes.opened(ref)),
			...entries.flatMap((entry) => unique(entry.uuid, transcriptEvents(entry, origin))),
			...nodes.settled(),
		];
	}
	function repaired(repair: Repair): readonly RunEvent[] {
		return [
			...repair.agents.flatMap((agent): readonly RunEvent[] => {
				if (!recorded(agent.agentId)) {
					const missing = agent.messages.flatMap((message) =>
						unique(
							message.uuid,
							transcriptEvents(message, { node: agent.agentId, spawnedBy: message.parent_tool_use_id ?? agentFileRef(agent.agentId) }),
						),
					);
					return adoptedEvents(agent, missing);
				}
				const origin = mirroredOrigins.get(agent.agentId) ?? {
					node: agent.agentId,
					spawnedBy: mapping.spawnerOf(agent.agentId) ?? agentFileRef(agent.agentId),
				};
				const missing = agent.messages.flatMap((message) => unique(message.uuid, transcriptEvents(message, origin)));
				if (missing.length === 0) {
					return [];
				}
				const gap: RunEvent = {
					detail: "Stored transcript UUIDs reveal output absent from the stream and mirror; recovered output follows",
					kind: "missing-output",
					origin,
					raw: claudeRaw("subagent/unrecorded-lines", { agentId: agent.agentId, uuids: agent.messages.map((message) => message.uuid) }),
					type: "gap",
				};
				return [gap, ...missing];
			}),
			...(repair.failure === undefined ? [] : [censusGap(repair.failure)]),
		];
	}
	return {
		deliver: (delivery: Delivery): readonly RunEvent[] => {
			if (delivery.kind === "mirror") {
				return mirrored(delivery.write);
			}
			if (delivery.kind === "repair") {
				return repaired(delivery.repair);
			}
			const message = delivery.message;
			if (message.type === "system" && message.subtype === "task_progress") {
				identities.observe(message);
				return nodes.settled();
			}
			return unique(message.uuid, mapping.frame(message)).map((event) =>
				event.type === "message" && delivery.inputId !== undefined ? { ...event, inputId: delivery.inputId } : event,
			);
		},
	};
}
