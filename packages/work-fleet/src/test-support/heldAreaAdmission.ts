import { Deferred, Effect } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";

export const heldAreaAdmission = isolatedEngine.trait(
	"configuration",
	"the second task pauses before transactional area admission",
	function* (state) {
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		state.recovery.gates = { entered, release };
		state.options = {
			...state.options,
			writeGate: (record) =>
				record.workId === "two" && record.step === "working" && record.attempts.at(-1)?.status === "submitting"
					? Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)))
					: Effect.void,
		};
	},
);
