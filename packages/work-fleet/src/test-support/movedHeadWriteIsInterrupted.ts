import { Deferred, Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";
import { MOVED } from "#test/githubResult.ts";

export function movedHeadWriteIsInterrupted() {
	return engineScenario("the moved-head write pauses before the new reviewer starts", () =>
		Effect.gen(function* () {
			const launching = yield* Deferred.make<void>();
			let interrupted = false;
			return {
				context: {
					get interrupted() {
						return interrupted;
					},
					set interrupted(value: typeof interrupted) {
						interrupted = value;
					},
					launching,
				},
				options: {
					reviewRunning: true,
					writeGate: (record) =>
						!interrupted && record.attempts.at(-1)?.reviewHead === MOVED
							? Deferred.succeed(launching, undefined).pipe(Effect.andThen(Effect.never))
							: Effect.void,
				},
			};
		}),
	);
}
