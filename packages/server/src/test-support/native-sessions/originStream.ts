import { Effect, Fiber, Predicate, Queue, Stream } from "effect";
import { words } from "#test/answers.ts";
import type { Host } from "./host.ts";
import { client } from "./requests.ts";

function hintWords(hint: unknown) {
	return Predicate.hasProperty(hint, "_tag") ? words(String(hint._tag)) : `unreadable update ${JSON.stringify(hint)}`;
}

function releasedAfter(host: Host, before: number) {
	return new Promise<void>((resolve) => {
		function check() {
			if (host.streams.released > before) {
				host.streams.waiters.delete(check);
				resolve();
			}
		}
		host.streams.waiters.add(check);
		check();
	});
}

export const originStream = Effect.fn("NativeOrigins.originStream")(function* (host: Host, origin: string, credential: string) {
	const rpc = yield* client(host, { authorization: `Bearer ${credential}`, origin }, true);
	const events = yield* Queue.unbounded<unknown>();
	const fiber = yield* rpc("native.$changes", { queries: [] }).pipe(
		Stream.runForEach((event) => Queue.offer(events, event)),
		Effect.forkScoped,
	);
	return {
		interrupt: Effect.gen(function* () {
			const released = host.streams.released;
			yield* Fiber.interrupt(fiber);
			yield* Effect.promise(() => releasedAfter(host, released));
		}),
		next: Effect.map(Queue.take(events), hintWords),
	};
});

export function openServerStreams(host: Host) {
	return Effect.promise(async () => {
		const result = await fetch(`${host.baseUrl}/resync`, { method: "POST", signal: AbortSignal.timeout(5000) });
		const count: unknown = await result.json();
		if (typeof count !== "number") {
			throw new Error("The host did not report its open stream count");
		}
		return count;
	});
}
