import { Effect } from "effect";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineScenario } from "#test/engineScenario.ts";

export function conflictRepairCanRaceDispatch(released: boolean) {
	return engineScenario("a conflict repair races a prepared provider retry", () => {
		let now = 100;
		let reject = false;
		let conflicting = false;
		return {
			context: {
				get conflicting() {
					return conflicting;
				},
				set conflicting(value: typeof conflicting) {
					conflicting = value;
				},
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
				get reject() {
					return reject;
				},
				set reject(value: typeof reject) {
					reject = value;
				},
			},
			options: {
				areaMergeWaitMs: released ? 5000 : 100_000,
				deliveryQuery: () => (conflicting ? Effect.fail(conflictingPr("main-revision")) : Effect.succeed(undefined)),
				now: () => now,
				submissionFailure: () =>
					reject ? new SessionFailure({ code: "session-queue-full", message: "Provider queue is full", reason: "rejected" }) : undefined,
			},
		};
	});
}
