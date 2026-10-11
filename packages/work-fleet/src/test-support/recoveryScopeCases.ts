import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

function revoke(context: RecoveryContext) {
	writeFileSync(join(context.root, "one.md"), context.source.replace("fleet: approved\n", ""));
}
function restore(context: RecoveryContext) {
	return Effect.sync(() => writeFileSync(join(context.root, "one.md"), context.source));
}
export function recoveryScopeCases(): readonly RecoveryCase[] {
	return [
		{
			enter: Effect.fnUntraced(function* (context) {
				yield* prepareWork("one");
				revoke(context);
				yield* (yield* Fleet).dispatch("one");
			}),
			name: "approval revoked before dispatch",
			progress: (_context, _before, after) => {
				expect(after.attempts).toHaveLength(1);
				expect(after.stage).toBe("executing");
			},
			reason: "Work is no longer approved or is done or superseded",
			restore,
			sites: ["engine/dispatchCommand.ts: authorized.failure.message"],
		},
		{
			enter: Effect.fnUntraced(function* (context) {
				yield* launchRecoveryWorker();
				revoke(context);
				setLastObservation(context, { execution: "completed", output: REPORT });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "approval revoked during execution",
			progress: (_context, before, after) => {
				expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
				expect(after.stage).toBe("reviewing");
			},
			reason: "Work is no longer approved or is done or superseded",
			restore,
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
	];
}
