import { Effect, Predicate, Queue, Stream } from "effect";
import { words } from "@shivaedev/test-story/server/answers.ts";
import type { Host } from "./host.ts";
import { client } from "./requests.ts";

function hintWords(hint: unknown) {
	return Predicate.hasProperty(hint, "_tag") ? words(String(hint._tag)) : `unreadable update ${JSON.stringify(hint)}`;
}

export const originStream = Effect.fn("NativeOrigins.originStream")(function* (host: Host, origin: string, credential: string) {
	const rpc = yield* client(host, { authorization: `Bearer ${credential}`, origin }, true);
	const events = yield* Queue.unbounded<unknown>();
	yield* rpc("native.$changes", { queries: [{ payload: undefined, query: "accounts" }] }).pipe(
		Stream.runForEach((event) => Queue.offer(events, event)),
		Effect.forkScoped,
	);
	return {
		next: Effect.map(Queue.take(events), hintWords),
	};
});

export function openServerStreams(host: Host) {
	return Effect.promise(async () => {
		const result = await fetch(`${host.baseUrl}/resync`, { method: "POST" });
		const count: unknown = await result.json();
		if (typeof count !== "number") {
			throw new Error("The host did not report its open stream count");
		}
		return count;
	});
}
