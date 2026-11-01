import { Cause, Effect, Exit, Fiber, Option, Scope, Semaphore } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeChannel, type TransactionBoundary } from "#channel.ts";
import { Current, makeDatabase } from "./fakeDatabase.ts";

function outcomeOf(exit: Exit.Exit<unknown, unknown>) {
	if (Exit.isSuccess(exit)) {
		return "succeeded";
	}
	return Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : Cause.pretty(exit.cause);
}

const create = Effect.gen(function* () {
	const connections = yield* Semaphore.make(1);
	const reservation = yield* Scope.make();
	yield* Scope.provide(
		Effect.acquireRelease(connections.take(1), () => connections.release(1)),
		reservation,
	);
	const owner = makeDatabase("occupied database");
	const channel = makeChannel<string>({ name: "acquisition", owner: Effect.succeed(owner), publish: () => Effect.void });
	let caller: Fiber.Fiber<unknown, unknown> | undefined;
	function native<A, E, R>(body: Effect.Effect<A, E, R>, boundary: TransactionBoundary) {
		return Effect.scoped(
			Effect.andThen(
				boundary.restore(Effect.acquireRelease(connections.take(1), () => connections.release(1), { interruptible: true })),
				owner.transaction(body),
			),
		);
	}
	return {
		interrupt: () =>
			Effect.suspend(() => {
				if (caller === undefined) {
					return Effect.die(new Error("Start a caller first"));
				}
				return Fiber.interrupt(caller).pipe(
					Effect.andThen(Fiber.await(caller)),
					Effect.timeoutOption("500 millis"),
					Effect.map(
						Option.match({
							onNone: () => "still waiting",
							onSome: outcomeOf,
						}),
					),
				);
			}),
		pending: () => Effect.sync(() => caller !== undefined && caller.pollUnsafe() === undefined),
		start: Effect.gen(function* () {
			caller = yield* channel
				.within(native)(owner.write("ada's order"))
				.pipe(Effect.provideService(Current, owner), Effect.forkScoped({ startImmediately: true }));
			yield* Effect.addFinalizer(() => Scope.close(reservation, Exit.void));
		}),
	};
});

export const acquisition = storyKit({
	clock: "live",
	create: () => create,
	name: "change channel connection acquisition",
	stages: [],
	verbs: (engine, story) => ({
		callerIsWaiting: engine.pending,
		interruptCaller: () => {
			story.tell("the caller interrupts its pending transaction while the only connection stays reserved");
			return engine.interrupt();
		},
		startCaller: () => {
			story.tell("a native adapter restores interruption while acquiring the occupied connection for ada's order");
			return engine.start;
		},
	}),
});
