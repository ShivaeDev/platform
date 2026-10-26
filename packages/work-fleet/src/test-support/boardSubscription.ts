import { Deferred, Effect, Fiber, Stream } from "effect";
import { supervisorBoardCall } from "#test/supervisorBoardCall.ts";

export const boardSubscription = Effect.fn("SupervisorStory.boardSubscription")(function* (port: number) {
	const started = yield* Deferred.make<void>();
	const subscription = yield* Effect.forkScoped(
		supervisorBoardCall(port, (client) =>
			client("work-board.subscribe", undefined).pipe(
				Stream.tap(() => Deferred.succeed(started, undefined)),
				Stream.runDrain,
			),
		),
	);
	yield* Deferred.await(started).pipe(Effect.timeout("5 seconds"));
	return { closed: Fiber.join(subscription) };
});
