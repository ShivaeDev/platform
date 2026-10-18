import { Deferred, Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";

export function scopeApproval(timing: "between review passes" | "while the reviewer finishes") {
	return engineScenario("Board approval is removed during independent review", () =>
		Effect.gen(function* () {
			const observing = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const betweenPasses = timing === "between review passes";
			return {
				context: { betweenPasses, observing, resume },
				options: {
					reviewGate: betweenPasses ? Effect.void : Deferred.succeed(observing, undefined).pipe(Effect.andThen(Deferred.await(resume))),
					reviewRunning: betweenPasses,
				},
			};
		}),
	);
}
