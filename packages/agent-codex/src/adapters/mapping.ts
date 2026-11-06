import { Option, Schema } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { itemCompleted, itemStarted } from "#adapters/items.ts";
import {
	ItemNotification,
	ModelReroutedNotification,
	ThreadStatusNotification,
	TokenUsageNotification,
	TurnNotification,
} from "#adapters/protocol.ts";
import { RATE_LIMITS_METHOD, rateLimitEvents } from "#adapters/rateLimitEvents.ts";
import type { RpcNotification } from "#adapters/rpc.ts";
export function rawOf(kind: string, payload: unknown) {
	return { kind, payload: JSON.stringify(payload), source: "codex" };
}
function mapped<A, E>(schema: Schema.Codec<A, E>, notification: RpcNotification, project: (value: A) => RunEvent[]): RunEvent[] {
	return Option.match(Schema.decodeUnknownOption(schema)(notification.params), {
		onNone: () => [{ raw: rawOf(notification.method, notification.params), type: "raw" }],
		onSome: project,
	});
}
export function toAgentEvents(notification: RpcNotification, model: string): RunEvent[] {
	const { method, params } = notification;
	const raw = rawOf(method, params);
	switch (method) {
		case RATE_LIMITS_METHOD:
			return rateLimitEvents(raw, params);
		case "item/started":
			return mapped(ItemNotification, notification, ({ item }) => itemStarted(raw, item));
		case "item/completed":
			return mapped(ItemNotification, notification, ({ item }) => itemCompleted(raw, item));
		case "turn/started":
			return mapped(TurnNotification, notification, () => [{ raw, state: "running", type: "execution" }]);
		case "turn/completed":
			return mapped(TurnNotification, notification, ({ turn }) => [
				{ raw, state: turn.status === "inProgress" ? "running" : turn.status, type: "execution" },
			]);
		case "thread/status/changed":
			return mapped(ThreadStatusNotification, notification, ({ status }) =>
				status.type === "active"
					? [{ raw, state: status.activeFlags.length > 0 ? "awaiting-input" : "running", type: "execution" }]
					: [{ raw, type: "raw" }],
			);
		case "thread/tokenUsage/updated":
			return mapped(TokenUsageNotification, notification, ({ tokenUsage }) => {
				const tokens = tokenUsage.total;
				return [
					{
						cacheReadTokens: tokens.cachedInputTokens,
						inputTokens: tokens.inputTokens,
						outputTokens: tokens.outputTokens,
						scope: "cumulative",
						type: "usage",
						unit: "session",
						...(model.length === 0 ? {} : { model }),
						...(tokens.cacheWriteInputTokens === undefined ? {} : { cacheWriteTokens: tokens.cacheWriteInputTokens }),
						raw,
					},
				];
			});
		case "model/rerouted":
			return mapped(ModelReroutedNotification, notification, ({ toModel, reason }) => [{ model: toModel, raw, reason, type: "model.changed" }]);
		default:
			return [{ raw, type: "raw" }];
	}
}
