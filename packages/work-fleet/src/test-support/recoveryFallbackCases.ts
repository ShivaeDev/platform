import { Effect } from "effect";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { isFleetError } from "#errors.ts";
import { Fleet } from "#fleet.ts";
import { BoardFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryFallbackCases(): readonly RecoveryCase[] {
	const failures = [
		...([
			{ code: "fleet-missing", failure: new NotFound({ message: "Host-specific failure text" }) },
			{ code: "fleet-stale", failure: new Conflict({ message: "Host-specific failure text" }) },
			{ code: "fleet-denied", failure: new Forbidden({ message: "Synthetic quota denial" }) },
			{ code: "fleet-integration", failure: new ServiceUnavailable({ message: "Host-specific failure text" }) },
			{ code: "fleet-invalid", failure: new BadRequest({ message: "Host-specific failure text" }) },
		] as const),
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
			if (isFleetError(failure)) {
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
			recovery: "review-after-boundary-recovery",
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
