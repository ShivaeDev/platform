import { Effect, Schema } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { ProtocolFailure, type ReadFailure } from "@shivaedev/agent/failures.ts";
import type { Observation, Receipt } from "@shivaedev/agent/run.ts";
import { itemCompleted, itemStarted } from "#adapters/items.ts";
import { rawOf } from "#adapters/mapping.ts";
import { AppServer } from "#adapters/server.ts";
export const Item = Schema.Struct({ clientId: Schema.optional(Schema.NullOr(Schema.String)), id: Schema.String, type: Schema.String });
export const Turn = Schema.Struct({
	id: Schema.String,
	items: Schema.Array(Schema.Unknown),
	status: Schema.Literals(["inProgress", "completed", "failed", "interrupted"]),
});
const Turns = Schema.Struct({ data: Schema.Array(Turn), nextCursor: Schema.NullOr(Schema.String) });
const Items = Schema.Struct({ data: Schema.Array(Schema.Struct({ item: Schema.Unknown })), nextCursor: Schema.NullOr(Schema.String) });
export function decode<A, E>(schema: Schema.Codec<A, E>, value: unknown) {
	return Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError(() => new ProtocolFailure({ backend: "codex", message: "Incompatible Codex response" })),
	);
}
export const readRequest = Effect.fn("Codex.readRequest")(function* (method: string, params: unknown) {
	const server = yield* AppServer;
	return yield* server.request(method, params).pipe(
		Effect.mapError(
			(error): ReadFailure =>
				error._tag === "BackendUnavailable" || error._tag === "ProtocolFailure"
					? error
					: new ProtocolFailure({
							backend: "codex",
							message: error.message,
							...(error.providerCode === undefined ? {} : { providerCode: error.providerCode }),
						}),
		),
	);
});
export const turns = Effect.fn("Codex.turns")(function* (threadId: string) {
	const found: (typeof Turn.Type)[] = [];
	const seen = new Set<string>();
	let cursor: string | null = null;
	do {
		const page: typeof Turns.Type = yield* readRequest("thread/turns/list", {
			cursor,
			itemsView: "full",
			limit: 100,
			sortDirection: "desc",
			threadId,
		}).pipe(Effect.flatMap((value) => decode(Turns, value)));
		found.push(...page.data);
		cursor = page.nextCursor;
		if (cursor !== null && seen.has(cursor)) {
			return yield* new ProtocolFailure({ backend: "codex", message: "Repeated turn cursor" });
		}
		if (cursor !== null) {
			seen.add(cursor);
		}
	} while (cursor !== null);
	return found;
});
export function observe(receipt: Receipt) {
	return turns(receipt.session?.value ?? "").pipe(
		Effect.map((values): Observation => {
			const turn = values.find((candidate) => candidate.id === receipt.reference.value);
			return turn === undefined
				? { reason: "The accepted turn is not observable; absence does not authorize replay", type: "missing" }
				: { state: turn.status === "inProgress" ? "running" : turn.status, type: "known" };
		}),
	);
}
export const transcript = Effect.fn("Codex.transcript")(function* (receipt: Receipt) {
	const events: RunEvent[] = [];
	const seen = new Set<string>();
	let cursor: string | null = null;
	do {
		const page: typeof Items.Type = yield* readRequest("thread/items/list", {
			cursor,
			limit: 100,
			sortDirection: "asc",
			threadId: receipt.session?.value,
			turnId: receipt.reference.value,
		}).pipe(Effect.flatMap((value) => decode(Items, value)));
		for (const { item } of page.data) {
			events.push(...itemStarted(rawOf("thread/items/list", item), item), ...itemCompleted(rawOf("thread/items/list", item), item));
		}
		cursor = page.nextCursor;
		if (cursor !== null && seen.has(cursor)) {
			return yield* new ProtocolFailure({ backend: "codex", message: "Repeated item cursor" });
		}
		if (cursor !== null) {
			seen.add(cursor);
		}
	} while (cursor !== null);
	return { completeness: events.some((event) => event.type === "raw") ? ("partial" as const) : ("complete" as const), events };
});
