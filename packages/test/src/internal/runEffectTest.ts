import type { TestContext } from "@effect/vitest";
import { Data, Effect, type Scope } from "effect";
import type { EffectClock } from "#types.ts";
import { environmentFor } from "./environmentFor.ts";

class TestScopeCloseTimeout extends Data.TaggedError("TestScopeCloseTimeout")<{ readonly message: string }> {}

export function runEffectTest<A, E>(effect: Effect.Effect<A, E, Scope.Scope>, context: TestContext, clock: EffectClock): Promise<A> {
	const result = Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(environmentFor(clock))), { signal: context.signal });
	// Vitest's timeout stops awaiting the body while Effect is still closing its Scope.
	context.onTestFinished(
		() =>
			Effect.runPromise(
				Effect.tryPromise(() => result).pipe(
					Effect.ignore,
					Effect.timeoutOrElse({
						duration: "5 seconds",
						orElse: () => Effect.fail(new TestScopeCloseTimeout({ message: `Test scope "${context.task.name}" did not close within 5000ms.` })),
					}),
				),
			),
		10_000,
	);
	return result;
}
