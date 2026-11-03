import type { Raw as RawSchema } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof RawSchema.Type;

import { Option, Schema } from "effect";
import { KnownItem } from "#adapters/protocolItems.ts";

type Item<T extends KnownItem["type"]> = Extract<KnownItem, { type: T }>;

export type SubAgentActivity = Item<"subAgentActivity">;
export type CollabCall = Item<"collabAgentToolCall">;

const decodeItem = Schema.decodeUnknownOption(KnownItem);

export function subAgentItem(item: unknown): SubAgentActivity | CollabCall | undefined {
	return Option.match(decodeItem(item), {
		onNone: () => undefined,
		onSome: (known) => (known.type === "subAgentActivity" || known.type === "collabAgentToolCall" ? known : undefined),
	});
}

export function announced(item: SubAgentActivity, threadId: string, spawnedBy: string, raw: RawPayload): AgentEvent {
	return {
		childRef: item.agentThreadId,
		label: item.agentPath,
		parentRef: threadId,
		raw,
		spawnedBy,
		type: "child.opened",
	};
}

// Codex reports forced sub-agent termination as `interrupted`.
export function interrupted(item: SubAgentActivity, raw: RawPayload): AgentEvent {
	return {
		childRef: item.agentThreadId,
		outcome: "interrupted",
		raw,
		type: "child.ended",
	};
}

export function closedWithoutWord(childRef: string, raw: RawPayload): AgentEvent {
	return {
		childRef,
		outcome: "unknown",
		raw,
		type: "child.ended",
	};
}

export function collabEvents(item: CollabCall, raw: RawPayload, started: boolean): readonly AgentEvent[] {
	return started
		? [
				{
					input: item.prompt ?? "",
					name: item.tool,
					raw,
					toolId: item.id,
					type: "tool.started",
				},
			]
		: [
				{
					ok: item.status === "completed",
					output: item.receiverThreadIds.join("\n"),
					raw,
					toolId: item.id,
					type: "tool.completed",
				},
			];
}
