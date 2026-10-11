import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { BoardFailure, FleetFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryFallbackCases(): readonly RecoveryCase[] {
	const failures = [
		...(["missing", "stale", "denied", "integration", "invalid"] as const).map((reason) => ({
			code: `fleet-${reason}` as const,
			failure: new FleetFailure({ message: reason === "denied" ? "Synthetic quota denial" : "Host-specific failure text", reason }),
		})),
		...(["unavailable", "rejected", "ambiguous", "protocol", "persistence"] as const).map((reason) => ({
			code: `session-${reason}` as const,
			failure: new SessionFailure({ message: "Provider-specific failure text", reason }),
		})),
		{ code: "board-failure" as const, failure: new BoardFailure({ message: "Board-specific failure text" }) },
	];
	return failures.map(({ code, failure }) => {
		let restored = false;
		let armed = false;
		let context: RecoveryContext | undefined;
		function fallbackOptions(): EngineOptions {
			if (failure instanceof FleetFailure) {
				return {
					resultQuery: (...args) => {
						if (!restored) {
							return Effect.fail(failure);
						}
						return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
					},
				};
			}
			if (failure instanceof SessionFailure) {
				return {
					decorateTransport: (transport) => ({
						...transport,
						observe: (receipt) => (armed && !restored ? Effect.fail(failure) : transport.observe(receipt)),
					}),
				};
			}
			return { decorateBoard: (board) => ({ ...board, get: (id) => (armed && !restored ? Effect.fail(failure) : board.get(id)) }) };
		}
		return {
			code,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				armed = true;
				yield* (yield* Fleet).reconcile("one");
			}),
			name: `uncoded integration boundary: ${code}`,
			options: fallbackOptions(),
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("reviewing");
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
