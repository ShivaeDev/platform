import { Effect, Fiber, Queue, Stream } from "effect";
import type { LiveHint } from "@shivaedev/contract/live.ts";

export const followHints = Effect.fnUntraced(function* <E, R>(stream: Stream.Stream<LiveHint, E, R>) {
	const hints: LiveHint[] = [];
	const queue = yield* Queue.unbounded<LiveHint>();
	const fiber = yield* stream.pipe(
		Stream.runForEach((hint) =>
			Effect.sync(() => {
				hints.push(hint);
			}).pipe(Effect.andThen(Queue.offer(queue, hint))),
		),
		Effect.result,
		Effect.forkScoped,
	);
	return { ended: Fiber.join(fiber).pipe(Effect.timeout("5 seconds")), hints, next: Queue.take(queue).pipe(Effect.timeout("5 seconds")) };
});
