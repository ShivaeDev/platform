import { Effect, Exit, Layer, Scope, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import type { LiveHint } from "@shivaedev/effect-contract/live.ts";
import type { HistoryInput } from "#history/schema.ts";
import { workRpcs } from "#rpc/contract.ts";
import { documents } from "#rpc/keys.ts";
import type { RunningBoard } from "./board.ts";

function protocol(board: Pick<RunningBoard, "url">) {
	return RpcClient.layerProtocolHttp({ url: `${board.url}/_board/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
}

function makeClient() {
	return RpcClient.make(workRpcs, { flatten: true });
}

type Client = Effect.Success<ReturnType<typeof makeClient>>;

function call<A, E>(board: Pick<RunningBoard, "url">, read: (client: Client) => Effect.Effect<A, E>) {
	return Effect.scoped(Effect.flatMap(makeClient(), read)).pipe(Effect.provide(protocol(board)));
}

export function rpcSearch(board: RunningBoard, query: string) {
	return call(board, (client) => client("work-board.search", { query }));
}

export function rpcHistory(board: RunningBoard, action: typeof HistoryInput.Type.action, baseline: string | null = null) {
	return call(board, (client) => client("work-board.history", { action, baseline }));
}

export function rpcWatcher(board: RunningBoard) {
	return call(board, (client) => client("work-board.watcher", undefined));
}

export interface EventStream {
	readonly close: () => Effect.Effect<void>;
	readonly next: () => Effect.Effect<LiveHint, unknown>;
}

export const subscribe = Effect.fn("Test.subscribe")(function* (board: Pick<RunningBoard, "url">) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const pull = yield* Effect.gen(function* () {
		const client = yield* makeClient();
		return yield* Stream.toPull(client("work-board.subscribe", undefined));
	}).pipe(Effect.provide(protocol(board)), Effect.provideService(Scope.Scope, scope));
	const pending: LiveHint[] = [];
	return {
		close: () => Scope.close(scope, Exit.void),
		next: () =>
			Effect.gen(function* () {
				if (pending.length === 0) {
					pending.push(...(yield* pull));
				}
				const hint = pending.shift();
				if (hint === undefined) {
					return yield* Effect.die(new Error("The native subscription returned no hint"));
				}
				return hint;
			}),
	};
});

export const changesUntil = Effect.fn("Test.changesUntil")(function* (events: EventStream, path: string) {
	for (;;) {
		const hint = yield* events.next();
		if (hint._tag === "Resync" || hint.keys.some((key) => key._tag === "Item" && key.collection === documents.name && key.id === path)) {
			return hint;
		}
	}
});
