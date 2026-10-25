import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

// The engine branches only on the failure code and the request-timeout wording, so other provider wording adds no recovery path.
const failures = [
	{ code: "session-turn-missing", message: "The acknowledged Codex turn is not observable" },
	{ code: "session-unavailable", message: "Codex connection is closed" },
	{ code: "session-unavailable", message: "Codex request timed out; preserve submission ownership" },
	{ code: "duplicate-turns", message: "Multiple Codex turns match one operation; retain reservation" },
] as const;

export function recoveryProviderCases(): readonly RecoveryCase[] {
	return failures.map(({ code, message }): RecoveryCase => {
		let restored = false;
		return {
			code,
			enter: finishRecoveryWorker,
			name: `provider boundary: ${message}`,
			options: {
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) =>
						restored
							? transport.observe(receipt)
							: Effect.fail(new SessionFailure({ code, message, reason: code === "session-turn-missing" ? "ambiguous" : "unavailable" })),
				}),
			},
			recovery: "review-existing-worker",
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
