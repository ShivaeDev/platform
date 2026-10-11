import { Context, Effect, Layer, ManagedRuntime, Stream } from "effect";
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
	return Effect.runPromise(Effect.scoped(Effect.flatMap(makeClient(), read)).pipe(Effect.provide(protocol(board))));
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
	readonly close: () => void;
	readonly next: () => Promise<LiveHint>;
}
export async function subscribe(board: Pick<RunningBoard, "url">): Promise<EventStream> {
	const initialize = Effect.gen(function* () {
		const client = yield* makeClient();
		return yield* Stream.toPull(client("work-board.subscribe", undefined));
	});
	class Subscription extends Context.Service<Subscription, Effect.Success<typeof initialize>>()("Test/Subscription") {}
	const runtime = ManagedRuntime.make(Layer.effect(Subscription, initialize).pipe(Layer.provide(protocol(board))));
	const pull = await runtime.runPromise(Subscription);
	const pending: LiveHint[] = [];
	return {
		close: () => {
			void runtime.dispose();
		},
		next: async () => {
			if (pending.length === 0) {
				pending.push(...(await runtime.runPromise(pull)));
			}
			const hint = pending.shift();
			if (hint === undefined) {
				throw new Error("The native subscription returned no hint");
			}
			return hint;
		},
	};
}
export async function changesUntil(events: EventStream, path: string): Promise<LiveHint> {
	for (;;) {
		const hint = await events.next();
		if (hint._tag === "Resync" || hint.keys.some((key) => key._tag === "Item" && key.collection === documents.name && key.id === path)) {
			return hint;
		}
	}
}
