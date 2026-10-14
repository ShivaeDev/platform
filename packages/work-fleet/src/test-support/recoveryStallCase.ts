import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryStallCase(): RecoveryCase {
	return {
		code: "session-stalled",
		enter: Effect.fnUntraced(function* (context) {
			yield* launchRecoveryWorker();
			const fleet = yield* Fleet;
			const stored = yield* fleet.get("one");
			yield* context.fixture.replaceRecord({
				...stored.value,
				attempts: stored.value.attempts.map((attempt) => ({
					...attempt,
					progress: { at: -1_860_000, signature: "[]" },
					stallRecovery: { count: 2, lastActionAt: -1_860_000 },
				})),
			});
			yield* fleet.reconcile("one");
		}),
		name: "stalled retry offers retry and release after terminal evidence",
		progress: (_context, before, after) => {
			expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
			expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
		},
		restore: Effect.fnUntraced(function* (context) {
			setLastObservation(context, { execution: "failed" });
			yield* (yield* Fleet).reconcile("one");
		}),
		sites: ['engine/recoverStall.ts: "session-stalled"'],
	};
}
