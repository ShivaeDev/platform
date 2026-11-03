import type { Origin as OriginSchema } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type Origin = typeof OriginSchema.Type;

import type { Raw as RawSchema } from "@shivaedev/agent/eventData.ts";

type RawPayload = typeof RawSchema.Type;

import { Option, Schema } from "effect";
import { attributed } from "#adapters/attributed.ts";
import { rawOf, toAgentEvents } from "#adapters/mapping.ts";
import { ItemNotification, SpawnedThread, ThreadScoped, ThreadSettingsUpdatedNotification } from "#adapters/protocol.ts";
import type { RpcNotification } from "#adapters/rpc.ts";
import {
	announced,
	type CollabCall,
	closedWithoutWord,
	collabEvents,
	interrupted,
	type SubAgentActivity,
	subAgentItem,
} from "#adapters/subagentItems.ts";
import type { ThreadClaims } from "#adapters/threadClaims.ts";

const decodeScoped = Schema.decodeUnknownOption(ThreadScoped);
const decodeSpawned = Schema.decodeUnknownOption(SpawnedThread);
const decodeItem = Schema.decodeUnknownOption(ItemNotification);
const decodeSettings = Schema.decodeUnknownOption(ThreadSettingsUpdatedNotification);

export interface ThreadTree {
	readonly events: (notification: RpcNotification) => readonly AgentEvent[];
}

// Ownership is tracked even when the application has no event subscriber.
export function openThreadTree(rootThreadId: string, claims: ThreadClaims, sessionModel: string): ThreadTree {
	const spawnCalls = new Map<string, string>();
	const stated = new Set<string>();
	const billing = new Map<string, string>();
	function owns(threadId: string): boolean {
		return threadId === rootThreadId || claims.ownerOf(threadId) === rootThreadId;
	}
	function billedOn(threadId: string): string {
		return billing.get(threadId) ?? sessionModel;
	}
	// A thread spends on what the thread that spawned it was spending on, until something names a model for it.
	function claimed(parent: string, child: string): void {
		claims.claim(rootThreadId, child);
		if (!billing.has(child)) {
			billing.set(child, billedOn(parent));
		}
	}
	function once(key: string): boolean {
		if (stated.has(key)) {
			return false;
		}
		stated.add(key);
		return true;
	}
	function spawnedThread(params: unknown): readonly AgentEvent[] {
		const spawned = decodeSpawned(params);
		if (Option.isNone(spawned)) {
			return [];
		}
		const { id, source } = spawned.value.thread;
		const parent = source.subAgent.threadSpawn.parentThreadId;
		if (owns(parent)) {
			claimed(parent, id);
		}
		return [];
	}
	function collab(item: CollabCall, threadId: string, raw: RawPayload, started: boolean): readonly AgentEvent[] {
		for (const receiver of item.receiverThreadIds) {
			claimed(threadId, receiver);
			spawnCalls.set(receiver, item.id);
		}
		return collabEvents(item, raw, started);
	}
	function activity(item: SubAgentActivity, threadId: string, raw: RawPayload): readonly AgentEvent[] {
		claimed(threadId, item.agentThreadId);
		const node = item.agentThreadId;
		if (item.kind === "interrupted") {
			return once(`ended/${node}`) ? [interrupted(item, raw)] : [{ raw, type: "raw" }];
		}
		return item.kind !== "started" || !once(`opened/${node}`)
			? [{ raw, type: "raw" }]
			: [announced(item, threadId, spawnCalls.get(node) ?? item.id, raw)];
	}
	function lifecycle(notification: RpcNotification, threadId: string): readonly AgentEvent[] | undefined {
		const decoded = decodeItem(notification.params);
		if (Option.isNone(decoded)) {
			return undefined;
		}
		const item = subAgentItem(decoded.value.item);
		if (item === undefined) {
			return undefined;
		}
		const raw = rawOf(notification.method, notification.params);
		return item.type === "collabAgentToolCall" ? collab(item, threadId, raw, notification.method === "item/started") : activity(item, threadId, raw);
	}
	function closed(threadId: string, params: unknown): readonly AgentEvent[] {
		const raw = rawOf("thread/closed", params);
		return once(`ended/${threadId}`) ? [closedWithoutWord(threadId, raw)] : [{ raw, type: "raw" }];
	}
	function mapped(notification: RpcNotification, threadId: string, root: boolean): readonly AgentEvent[] {
		return !root && notification.method === "thread/closed"
			? closed(threadId, notification.params)
			: (lifecycle(notification, threadId) ?? toAgentEvents(notification, billedOn(threadId)));
	}
	function rebill(threadId: string, foundEvents: readonly AgentEvent[]): void {
		for (const mappedEvent of foundEvents) {
			if (mappedEvent.type === "model.changed") {
				billing.set(threadId, mappedEvent.model);
			}
		}
	}
	function settled(notification: RpcNotification, threadId: string): void {
		if (notification.method !== "thread/settings/updated") {
			return;
		}
		const settings = decodeSettings(notification.params);
		if (Option.isSome(settings)) {
			billing.set(threadId, settings.value.threadSettings.model);
		}
	}
	function events(notification: RpcNotification): readonly AgentEvent[] {
		if (notification.method === "thread/started") {
			return spawnedThread(notification.params);
		}
		const scoped = decodeScoped(notification.params);
		if (Option.isNone(scoped) || !owns(scoped.value.threadId)) {
			return [];
		}
		const threadId = scoped.value.threadId;
		const root = threadId === rootThreadId;
		settled(notification, threadId);
		const found = mapped(notification, threadId, root);
		rebill(threadId, found);
		if (root) {
			return found;
		}
		const origin: Origin = {
			node: threadId,
			spawnedBy: spawnCalls.get(threadId) ?? threadId,
		};
		return found.map((event) => attributed(event, origin));
	}
	return { events };
}
