import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { activeTurnRaces } from "#test/activeTurnRaces.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryActiveTurnCase(): RecoveryCase {
	let restored = false;
	return {
		code: "session-active-turn",
		enter: launchRecoveryWorker,
		name: "reworded active-turn races exhaust the bounded retry and recover after restart",
		options: {
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) =>
					restored
						? transport.startTurn(input)
						: activeTurnRaces(input.sessionId).pipe(Effect.map(({ turn }) => ({ sessionId: input.sessionId, turnId: turn.id }))),
			}),
		},
		progress: (_context, before, after) => {
			const retry = after.attempts.at(-1);
			expect(retry?.receipt).toBeDefined();
			expect(retry?.operationId).not.toBe(before.attempts.at(-1)?.operationId);
			expect(after.stage).toBe("executing");
		},
		restore: () =>
			Effect.sync(() => {
				restored = true;
			}),
		sites: ["engine/submissionFailure.ts: failureCode(error)"],
	};
}
