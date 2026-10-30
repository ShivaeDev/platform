import { Effect, Fiber, Queue, Stream } from "effect";

interface Resync {
	readonly _tag: "Resync";
}

export const notificationStreams = Effect.sync(() => {
	const streams = new Set<Queue.Queue<Resync>>();
	function open() {
		return Effect.gen(function* () {
			const hints: Resync[] = [];
			const received = yield* Queue.unbounded<void>();
			const fiber = yield* Effect.gen(function* () {
				const queue = yield* Effect.acquireRelease(
					Effect.gen(function* () {
						const opened = yield* Queue.unbounded<Resync>();
						streams.add(opened);
						return opened;
					}),
					(opened) =>
						Effect.sync(() => {
							streams.delete(opened);
						}),
				);
				yield* Queue.offer(queue, { _tag: "Resync" });
				return yield* Stream.fromQueue(queue).pipe(
					Stream.runForEach((hint) => Effect.sync(() => hints.push(hint)).pipe(Effect.andThen(Queue.offer(received, undefined)))),
				);
			}).pipe(Effect.scoped, Effect.forkScoped);
			return { close: Fiber.interrupt(fiber), hints, nextHint: Queue.take(received) };
		});
	}
	const resync = Effect.sync(() => {
		for (const stream of streams) {
			Queue.offerUnsafe(stream, { _tag: "Resync" });
		}
		return streams.size;
	});
	return { open, resync };
});
