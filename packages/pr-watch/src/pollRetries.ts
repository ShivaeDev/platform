import { Clock, Effect } from "effect";
import { WatchError } from "#model.ts";

export function pollRetries(interval: number) {
	let failures = 0;
	let outage: { since: number; error: WatchError } | undefined;
	const outageLimit = 60 * 60_000;
	return {
		check: Effect.gen(function* () {
			if (outage !== undefined && (yield* Clock.currentTimeMillis) - outage.since >= outageLimit) {
				return yield* new WatchError({ message: `GitHub outage exceeded 1 hour: ${outage.error.message}` });
			}
		}),
		delay: (error: WatchError, pacing: number) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				outage = { error, since: outage?.since ?? now };
				failures += 1;
				const delay = Math.max(pacing, Math.min(300_000, interval * 2 ** (failures - 1)), (error.retryAt ?? now) - now);
				return Math.min(delay, outage.since + outageLimit - now);
			}),
		reset: () => {
			failures = 0;
			outage = undefined;
		},
	};
}
