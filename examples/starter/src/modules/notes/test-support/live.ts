import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Queue, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Key } from "@shivaedev/changes/keys.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { SubscriptionHint } from "@shivaedev/contract/queryUpdate.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { Notes } from "#modules/notes/notes.ts";
import { answerWithReason, refusal } from "#test-support/answers.ts";
import type { RpcAddress } from "./Engine.ts";

const liveClient = Effect.fn("AppStory.liveClient")(function* (address: RpcAddress, cookie: string) {
	const client = makeNotesClient(`${address.baseUrl}/rpc`, {
		headers: { cookie, origin: address.origin },
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	return { client, registry };
});

// The live client reports every settled result, so a story waits for the next one instead of polling the screen.
const settledResults = Effect.fn("AppStory.settledResults")(function* <A, E>(
	registry: AtomRegistry.AtomRegistry,
	query: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
	const results = yield* Queue.unbounded<AsyncResult.AsyncResult<A, E>>();
	let previous: AsyncResult.AsyncResult<A, E> | undefined;
	yield* Effect.acquireRelease(
		Effect.sync(() =>
			registry.subscribe(
				query,
				(result) => {
					if (!(AsyncResult.isInitial(result) || result.waiting) && result !== previous) {
						previous = result;
						Queue.offerUnsafe(results, result);
					}
				},
				{ immediate: true },
			),
		),
		(stop) => Effect.sync(stop),
	);
	return {
		latest: () => AsyncResult.getOrElse(registry.get(query), () => undefined),
		next: () => answerWithReason(Effect.flatMap(Queue.take(results), AsyncResult.toExit)),
	};
});

export const watchedList = Effect.fn("AppStory.watchedList")(function* (address: RpcAddress, cookie: string) {
	const { client, registry } = yield* liveClient(address, cookie);
	const results = yield* settledResults(registry, client.api.list.query());
	return { latestList: () => Effect.sync(results.latest), nextList: results.next };
});

export const watchedNote = Effect.fn("AppStory.watchedNote")(function* (address: RpcAddress, cookie: string, id: number) {
	const { client, registry } = yield* liveClient(address, cookie);
	const query = client.api.get.query({ id });
	const results = yield* settledResults(registry, query);
	return { nextNote: results.next, refresh: () => Effect.sync(() => registry.refresh(query)) };
});

function changesClient(address: RpcAddress, cookie: string) {
	return makeClient(Notes, {
		headers: { cookie, origin: address.origin },
		url: `${address.baseUrl}/rpc`,
		webSocketConstructor: layerWebSocketConstructorWS,
	}).client;
}

export const noteChangesSubscription = Effect.fn("AppStory.noteChangesSubscription")(function* (address: RpcAddress, cookie: string, id: number) {
	const client = yield* changesClient(address, cookie);
	return yield* refusal(client["notes.$changes"]({ queries: [{ payload: { id }, query: "get" }] }).pipe(Stream.runHead));
});

export const changeHints = Effect.fn("AppStory.changeHints")(function* (address: RpcAddress, cookie: string, describe: (key: Key) => string) {
	const client = yield* changesClient(address, cookie);
	const hints = yield* Queue.unbounded<SubscriptionHint>();
	yield* client["notes.$changes"]({ queries: [{ payload: undefined, query: "list" }] }).pipe(
		Stream.runForEach((hint) => Queue.offer(hints, hint)),
		Effect.forkScoped,
	);
	yield* Queue.take(hints);
	return {
		nextHint: () =>
			Effect.map(Queue.take(hints), (hint) => {
				if (hint._tag === "QueryReadDenied") {
					return "read denied";
				}
				return hint._tag === "Resync" ? "resync" : `changed ${hint.keys.map(describe).join(", ")}`;
			}),
	};
});
