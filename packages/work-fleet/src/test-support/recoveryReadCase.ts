import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryReadCase(): RecoveryCase {
	let restored = false;
	let now = 100;
	const error = new SessionFailure({ capacity: "serverOverloaded", message: "Provider state lookup at capacity", reason: "rejected" });
	return {
		code: "session-rejected",
		enter: Effect.fnUntraced(function* (context) {
			yield* finishRecoveryWorker(context);
			const fleet = yield* Fleet;
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				expect(executing((yield* fleet.get("one")).value)).toBe(true);
				now += delay;
				yield* context.fixture.restart(fleet.reconcile("one"));
			}
			const parked = (yield* fleet.get("one")).value;
			expect(parked.decision?.reason).toContain("provider read failure after 5 attempts");
			expect(parked.attempts).toHaveLength(1);
			expect(executing(parked)).toBe(true);
		}),
		name: "capacity read exhaustion retains execution ownership and recovers the existing operation",
		options: {
			decorateTransport: (transport) => ({ ...transport, observe: (receipt) => (restored ? transport.observe(receipt) : Effect.fail(error)) }),
			now: () => now,
		},
		progress: (_context, before, after) => {
			expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
			expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
			expect(after.attempts[0]?.status).toBe("completed");
			expect(after.attempts.at(-1)?.role).toBe("reviewer");
			expect(after.step).toBe("reviewing");
		},
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/readRetry.ts: failureCode(error)"],
	};
}
