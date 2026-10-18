import type { TestContext } from "@effect/vitest";
import { Cause, Effect, Exit, type Scope } from "effect";
import type { EffectClock } from "#types.ts";
import { environmentFor } from "./environmentFor.ts";

export function runEffectTest<A, E>(effect: Effect.Effect<A, E, Scope.Scope>, context: TestContext, clock: EffectClock): Promise<A> {
	const result = Effect.runPromise(
		Effect.gen(function* () {
			const exit = yield* Effect.exit(effect);
			if (Exit.isFailure(exit)) {
				for (const error of Cause.prettyErrors(exit.cause)) {
					yield* Effect.logError(error);
				}
			}
			return yield* exit;
		}).pipe(Effect.scoped, Effect.provide(environmentFor(clock))),
		{ signal: context.signal },
	);
	// Vitest's timeout stops awaiting the body while Effect is still closing its Scope.
	const settled = result.then(
		() => undefined,
		() => undefined,
	);
	context.onTestFinished(() => settled, 0);
	return result;
}
