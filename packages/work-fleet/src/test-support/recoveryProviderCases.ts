import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

const failures = [
	{ code: "session-turn-missing", message: "No matching accepted turn is observable; absence does not authorize replay" },
	{ code: "session-unavailable", message: "Codex CLI could not refresh the login" },
	{ code: "session-unavailable", message: "Codex CLI could not refresh the login; sign in with the Codex CLI" },
	{ code: "session-unavailable", message: "Codex CLI login refresh timed out" },
	{ code: "session-unavailable", message: "Codex Cloud bearer authentication requires a wss endpoint" },
	{ code: "session-unavailable", message: "Codex Cloud configuration needs an environment, workspace cwd and positive timeout" },
	{ code: "session-unavailable", message: "Codex Cloud did not confirm the configured environment and cwd; retain the session" },
	{ code: "session-unavailable", message: "Codex connection is closed" },
	{ code: "session-unavailable", message: "Codex connection timed out" },
	{ code: "session-unavailable", message: "Codex disconnected; reconcile persisted submission before retrying" },
	{ code: "session-unavailable", message: "Codex login file has no ChatGPT access token; sign in with the Codex CLI" },
	{ code: "session-unavailable", message: "Codex login file is unavailable" },
	{ code: "session-unavailable", message: "Codex login is expired; sign in with the Codex CLI" },
	{ code: "session-unavailable", message: "Codex login token is unreadable; sign in with the Codex CLI" },
	{ code: "session-unavailable", message: "Codex repeated a turn pagination cursor" },
	{ code: "session-unavailable", message: "Codex repeated an item pagination cursor" },
	{ code: "session-unavailable", message: "Codex request timed out; preserve submission ownership" },
	{ code: "session-unavailable", message: "Codex returned an incompatible protocol response" },
	{ code: "session-unavailable", message: "Codex returned an invalid protocol envelope" },
	{ code: "session-unavailable", message: "Codex write failed" },
	{ code: "session-unavailable", message: "Could not connect to the configured Codex endpoint" },
	{ code: "session-unavailable", message: "Invalid Codex Cloud endpoint" },
	{ code: "session-unavailable", message: "Invalid Codex endpoint" },
	{ code: "session-unavailable", message: "Lost thread acknowledgement cannot be reconciled by this Codex protocol; retain reservation" },
	{ code: "duplicate-turns", message: "Multiple Codex turns match one operation; retain reservation" },
	{ code: "session-turn-missing", message: "The acknowledged Codex turn is not observable" },
	{ code: "session-unavailable", message: "Work cwd differs from the configured Codex Cloud workspace cwd" },
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
			progress: (_ctx, before, after) => {
				expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
				expect(after.stage).toBe("reviewing");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
