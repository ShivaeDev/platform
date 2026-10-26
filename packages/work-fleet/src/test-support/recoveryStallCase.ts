import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryStallCase(): RecoveryCase {
	let now = 100;
	return {
		code: "session-stalled",
		enter: Effect.fnUntraced(function* (context) {
			yield* launchRecoveryWorker();
			const fleet = yield* Fleet;
			setLastObservation(context, { execution: "running", progress: [] });
			yield* fleet.reconcile("one");
			now += 31 * 60_000;
			yield* fleet.reconcile("one");
		}),
		name: "stalled retry offers retry and release after terminal evidence",
		options: { now: () => now },
		recovery: "resume-stalled-worker",
		restore: Effect.fnUntraced(function* (context) {
			setLastObservation(context, { execution: "failed" });
			yield* (yield* Fleet).reconcile("one");
		}),
		sites: ['engine/recoverStall.ts: "session-stalled"'],
	};
}
