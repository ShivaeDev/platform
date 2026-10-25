import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { activeTurnRaces } from "#test/activeTurnRaces.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryActiveTurnCase(code: "session-active-turn" | "session-active-turn-exhausted"): RecoveryCase {
	let restored = false;
	let now = 100;
	function rejectedTurn(sessionId: string) {
		return activeTurnRaces(sessionId, code === "session-active-turn-exhausted").pipe(Effect.map(({ turn }) => ({ sessionId, turnId: turn.id })));
	}
	return {
		code,
		enter: Effect.fn("Test.enter")(function* (context) {
			yield* launchRecoveryWorker();
			const fleet = yield* Fleet;
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				now += delay;
				yield* context.fixture.restart(fleet.dispatch("one"));
			}
		}),
		name:
			code === "session-active-turn-exhausted"
				? "reworded active-turn races exhaust the bounded retry and recover after restart"
				: "reworded active-turn wait expires and recovers after restart",
		options: {
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => (restored ? transport.startTurn(input) : rejectedTurn(input.sessionId)),
			}),
			now: () => now,
		},
		recovery: "fresh-worker-session",
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/capacityRetry.ts: failureCode(error)"],
	};
}
