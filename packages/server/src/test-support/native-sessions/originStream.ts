import { Effect, Fiber, Queue, Stream } from "effect";
import type { Host } from "./host.ts";
import { client } from "./requests.ts";

export const originStream = Effect.fn("NativeOrigins.originStream")(function* (host: Host, origin: string, credential: string) {
	const rpc = yield* client(host, { authorization: `Bearer ${credential}`, origin });
	const events = yield* Queue.unbounded<unknown>();
	const fiber = yield* rpc("native.$changes", { queries: [] }).pipe(
		Stream.runForEach((event) => Queue.offer(events, event)),
		Effect.result,
		Effect.forkScoped,
	);
	const next = Queue.take(events).pipe(Effect.timeout("5 seconds"));
	const resync = Effect.promise(async () => {
		const result = await fetch(`${host.baseUrl}/resync`, { method: "POST", signal: AbortSignal.timeout(5000) });
		const count: unknown = await result.json();
		if (typeof count !== "number") {
			throw new Error("The host did not report its open stream count");
		}
		return count;
	});
	return {
		abort: Fiber.interrupt(fiber),
		awaitReleased: Effect.gen(function* () {
			let open = yield* resync;
			while (open !== 0) {
				yield* Effect.sleep("10 millis");
				open = yield* resync;
			}
			return open;
		}).pipe(Effect.timeout("5 seconds")),
		next,
		resync,
	};
});
