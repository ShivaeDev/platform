import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
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
				context.readRetries.push((yield* fleet.get("one")).value);
				now += delay;
				yield* context.fixture.restart(fleet.reconcile("one"));
			}
		}),
		name: "capacity read exhaustion retains execution ownership and recovers the existing operation",
		options: {
			decorateTransport: (transport) => ({ ...transport, observe: (receipt) => (restored ? transport.observe(receipt) : Effect.fail(error)) }),
			now: () => now,
		},
		recovery: "resume-capacity-read",
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/readRetry.ts: failureCode(error)"],
	};
}
