import { Effect, Fiber } from "effect";
import type { QueryControl } from "#test/queryControls.ts";

export const parallelQueries = Effect.fnUntraced(function* <A, E, R>(query: Effect.Effect<A, E, R>, control: QueryControl) {
	const fiber = yield* Effect.forkChild(Effect.all([query, query], { concurrency: "unbounded" }), { startImmediately: true });
	yield* control.both.wait;
	const maximumActive = control.maximumActive;
	control.release();
	return { maximumActive, results: yield* Fiber.join(fiber) };
});
