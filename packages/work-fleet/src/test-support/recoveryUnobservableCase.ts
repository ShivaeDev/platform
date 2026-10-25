import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryUnobservableCase(): RecoveryCase {
	let now = 100;
	return {
		code: "session-turn-missing",
		enter: Effect.fnUntraced(function* (context) {
			yield* launchRecoveryWorker();
			const fleet = yield* Fleet;
			for (let loss = 0; loss < 2; loss += 1) {
				setLastObservation(context, { execution: "accepted", progress: [], turnMissing: true });
				yield* fleet.reconcile("one");
				now += 5 * 60_000;
				yield* fleet.reconcile("one");
			}
		}),
		name: "a second invisible turn offers retry and release after terminal evidence",
		options: { now: () => now },
		recovery: "resume-visible-worker",
		restore: Effect.fnUntraced(function* (context) {
			setLastObservation(context, { execution: "failed", turnMissing: false });
			yield* (yield* Fleet).reconcile("one");
		}),
		sites: ['engine/recoverUnobservable.ts: "session-turn-missing"'],
	};
}
