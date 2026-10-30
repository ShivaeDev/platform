import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Exit, Layer, Option, Scope, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { workRpcs } from "#rpc/contract.ts";
import { documents } from "#rpc/keys.ts";
import type { RunningBoard } from "#test/board.ts";

function protocol(board: Pick<RunningBoard, "url">, native = false) {
	return RpcClient.layerProtocolHttp({ url: `${board.url}/_board/rpc` }).pipe(
		Layer.provide([native ? NodeHttpClient.layerNodeHttp : FetchHttpClient.layer, RpcSerialization.layerNdjson]),
	);
}

function makeClient() {
	return RpcClient.make(workRpcs, { flatten: true });
}

type Client = Effect.Success<ReturnType<typeof makeClient>>;

export function rpcCall<A, E>(board: Pick<RunningBoard, "url">, read: (client: Client) => Effect.Effect<A, E>, native = false) {
	return Effect.scoped(Effect.flatMap(makeClient(), read)).pipe(Effect.provide(protocol(board, native)));
}

export function rpcLibrary(board: RunningBoard) {
	return rpcCall(board, (client) => client("work-board.library", {}));
}
export function rpcPaths(board: RunningBoard) {
	return Effect.map(rpcLibrary(board), (data) => data.files.map((file) => file.href));
}
export function rpcNavigation(board: RunningBoard) {
	return rpcCall(board, (client) => client("work-board.navigation", { current: "" }));
}
export function rpcSearch(board: RunningBoard, query: string) {
	return rpcCall(board, (client) => client("work-board.search", { query }));
}

export function rpcWatcher(board: RunningBoard) {
	return rpcCall(board, (client) => client("work-board.watcher", undefined));
}

export interface EventStream {
	readonly close: () => Effect.Effect<void>;
	readonly next: () => Effect.Effect<LiveHint, unknown>;
}

export const subscribe = Effect.fn("Test.subscribe")(function* (board: Pick<RunningBoard, "url">, indexOnly = false) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const socket = RpcClient.layerProtocolSocket().pipe(
		Layer.provide(
			Socket.layerWebSocket(`${board.url.replace(/^http/u, "ws")}/_board/rpc`).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
		),
		Layer.provide(RpcSerialization.layerNdjson),
	);
	const context = yield* Layer.buildWithScope(socket, scope);
	const pull = yield* Effect.gen(function* () {
		const client = yield* makeClient();
		if (indexOnly) {
			return yield* Stream.toPull(client("work-board.$changes", { queries: [{ payload: undefined, query: "index" }] }));
		}
		const library = yield* client("work-board.library", { showFleet: true });
		const readings = yield* Effect.forEach(library.files, (file) => Effect.option(client("work-board.document", { url: file.href })));
		const identities = readings
			.filter(Option.isSome)
			.map((entry) => entry.value)
			.flatMap((doc) =>
				typeof doc.metadata.id === "string"
					? [{ payload: { url: `/_board/item/${encodeURIComponent(doc.metadata.id)}/` }, query: "document" as const }]
					: [],
			);
		return yield* Stream.toPull(
			client("work-board.$changes", {
				queries: [
					...library.files.map((file) => ({ payload: { url: file.href }, query: "document" as const })),
					...identities,
					{ payload: { url: "/" }, query: "board" },
					{ payload: undefined, query: "overview" },
					{ payload: undefined, query: "watcher" },
				],
			}),
		);
	}).pipe(Effect.provideContext(context), Effect.provideService(Scope.Scope, scope));
	const pending: LiveHint[] = [];
	return {
		close: () => Scope.close(scope, Exit.void),
		next: () =>
			Effect.gen(function* () {
				while (pending.length === 0) {
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
		if (
			hint._tag === "Resync"
			|| hint.keys.some((key) => (key._tag === "Item" && key.collection === documents.name && key.id === path) || key._tag === "Bucket")
		) {
			return hint;
		}
	}
});

// macOS replays FSEvents for files created just before the watch starts, so a change naming the path can predate the write under test.
export const changesUntilShown = Effect.fn("Test.changesUntilShown")(function* <E>(
	events: EventStream,
	path: string,
	shown: Effect.Effect<boolean, E>,
) {
	for (;;) {
		const hint = yield* changesUntil(events, path);
		if (yield* shown) {
			return hint;
		}
	}
});

export function libraryCount(board: RunningBoard) {
	return Effect.map(
		rpcCall(board, (client) => client("work-board.navigation", { current: "" }), true),
		(data) => data.counts.library,
	);
}

export function rpcDocument(board: Pick<RunningBoard, "url">, url: string) {
	return rpcCall(board, (client) => client("work-board.document", { url }));
}
