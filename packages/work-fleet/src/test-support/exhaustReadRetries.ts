import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { EngineFixture } from "#test/engine.ts";

export const exhaustReadRetries = Effect.fn("Test.exhaustReadRetries")(function* (fixture: Pick<EngineFixture<unknown>, "restart">) {
	const fleet = yield* Fleet;
	for (let count = 0; count < 4; count += 1) {
		const current = yield* fleet.get("one");
		const retry = current.value.integrationRetry;
		if (retry === undefined) {
			return current;
		}
		yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))), (policy) => ({ ...policy, now: () => retry.retryAt }));
	}
	return yield* fleet.get("one");
});
