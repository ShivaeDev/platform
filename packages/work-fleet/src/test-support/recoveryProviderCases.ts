import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

const reasons = [
	"No matching accepted turn is observable; absence does not authorize replay",
	"Codex CLI could not refresh the login",
	"Codex CLI could not refresh the login; sign in with the Codex CLI",
	"Codex CLI login refresh timed out",
	"Codex Cloud bearer authentication requires a wss endpoint",
	"Codex Cloud configuration needs an environment, workspace cwd and positive timeout",
	"Codex Cloud did not confirm the configured environment and cwd; retain the session",
	"Codex connection is closed",
	"Codex connection timed out",
	"Codex disconnected; reconcile persisted submission before retrying",
	"Codex login file has no ChatGPT access token; sign in with the Codex CLI",
	"Codex login file is unavailable",
	"Codex login is expired; sign in with the Codex CLI",
	"Codex login token is unreadable; sign in with the Codex CLI",
	"Codex repeated a turn pagination cursor",
	"Codex repeated an item pagination cursor",
	"Codex request timed out; preserve submission ownership",
	"Codex returned an incompatible protocol response",
	"Codex returned an invalid protocol envelope",
	"Codex write failed",
	"Could not connect to the configured Codex endpoint",
	"Invalid Codex Cloud endpoint",
	"Invalid Codex endpoint",
	"Lost thread acknowledgement cannot be reconciled by this Codex protocol; retain reservation",
	"Multiple Codex turns match one operation; retain reservation",
	"The acknowledged Codex turn is not observable",
	"Work cwd differs from the configured Codex Cloud workspace cwd",
] as const;

export function recoveryProviderCases(): readonly RecoveryCase[] {
	return reasons.map((reason): RecoveryCase => {
		let restored = false;
		return {
			enter: finishRecoveryWorker,
			name: `provider boundary: ${reason}`,
			options: {
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) => (restored ? transport.observe(receipt) : Effect.fail(new SessionFailure({ message: reason, reason: "unavailable" }))),
				}),
			},
			progress: (_ctx, before, after) => {
				expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
				expect(after.stage).toBe("reviewing");
			},
			reason,
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		};
	});
}
