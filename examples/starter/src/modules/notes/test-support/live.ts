import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Equal, Queue, Schema, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { settledQueries } from "@shivaedev/test-kits/contract/settledQueries.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { Note } from "#modules/notes/model.ts";
import type { RpcAddress } from "#modules/notes/test-support/Engine.ts";
import { answerWithReason, refusal } from "#test-support/answers.ts";

const liveClient = Effect.fn("AppStory.liveClient")(function* (address: RpcAddress, cookie: string) {
	const client = makeNotesClient(`${address.baseUrl}/rpc`, {
		headers: { cookie, origin: address.origin },
		webSocketConstructor: layerWebSocketConstructor,
	});
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	return { client, registry };
});

export const watchedList = Effect.fn("AppStory.watchedList")(function* (address: RpcAddress, cookie: string) {
	const { client, registry } = yield* liveClient(address, cookie);
	const results = yield* settledQueries(client.api.list.query()).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry));
	return {
		latestList: () => Effect.map(results.latest, (result) => AsyncResult.getOrElse(result, () => undefined)),
		nextList: () => answerWithReason(Effect.flatMap(results.next, AsyncResult.toExit)),
	};
});

export const watchedNote = Effect.fn("AppStory.watchedNote")(function* (address: RpcAddress, cookie: string, id: number) {
	const { client, registry } = yield* liveClient(address, cookie);
	const results = yield* settledQueries(client.api.get.query({ id })).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry));
	const nextAnswer = answerWithReason(Effect.flatMap(results.next, AsyncResult.toExit));
	let seen: Effect.Success<typeof nextAnswer> | undefined;
	const remember = Effect.tap(nextAnswer, (answer) =>
		Effect.sync(() => {
			seen = answer;
		}),
	);
	return {
		// A rerun for an earlier change can still answer after a command returns, so only a differing answer carries the command's change.
		changedNote: () =>
			Effect.gen(function* () {
				const before = seen;
				while (true) {
					const answer = yield* remember;
					if (!Equal.equals(answer, before)) {
						return answer;
					}
				}
			}),
		nextNote: () => remember,
	};
});

function changesClient(address: RpcAddress, cookie: string) {
	return makeClient(Notes, {
		headers: { cookie, origin: address.origin },
		url: `${address.baseUrl}/rpc`,
		webSocketConstructor: layerWebSocketConstructor,
	}).client;
}

export const noteChangesSubscription = Effect.fn("AppStory.noteChangesSubscription")(function* (address: RpcAddress, cookie: string, id: number) {
	const client = yield* changesClient(address, cookie);
	return yield* refusal(client["notes.$changes"]({ queries: [{ payload: { id }, query: "get" }] }).pipe(Stream.runHead));
});

export const changeHints = Effect.fn("AppStory.changeHints")(function* (address: RpcAddress, cookie: string) {
	const client = yield* changesClient(address, cookie);
	const hints = yield* Queue.unbounded<QueryUpdate>();
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
				return hint._tag === "Result"
					? `result ${Schema.decodeUnknownSync(Schema.toType(Schema.Array(Note.json)))(hint.value)
							.map((note) => note.title)
							.join(", ")}`
					: hint._tag.toLowerCase();
			}),
	};
});
