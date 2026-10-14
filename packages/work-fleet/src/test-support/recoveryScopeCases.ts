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
			code: "incomplete-context",
			enter: Effect.fnUntraced(function* (context) {
				writeFileSync(
					join(context.root, "one.md"),
					context.source.replace("kind: task", "kind: task\ncriteria: [{ id: evidence, text: Read private/board/documents. }]"),
				);
				yield* prepareWork("one");
				yield* context.fixture.restart(Fleet.pipe(Effect.flatMap((fleet) => fleet.dispatch("one"))), (policy) => ({
					...policy,
					localOnlyBoardPath: "private/board",
				}));
				expect(context.fixture.starts).toHaveLength(0);
			}),
			name: "criterion needs Board data unavailable under the launch policy",
			progress: (_context, _before, after) => {
				expect(after.attempts).toHaveLength(1);
				expect(after.stage).toBe("executing");
			},
			sites: ['engine/makeLaunch.ts: "incomplete-context"'],
		},
		{
			code: "fleet-stale" as const,
			enter: Effect.fnUntraced(function* (context) {
				yield* prepareWork("one");
				writeFileSync(join(context.root, "one.md"), `${context.source}\nChanged criteria.\n`);
				yield* (yield* Fleet).dispatch("one");
			}),
			name: "authored brief changed before dispatch",
			progress: (_context, _before, after) => {
				expect(after.attempts).toHaveLength(1);
				expect(after.stage).toBe("executing");
			},
			restore,
			sites: ["engine/dispatchCommand.ts: failureCode(authorized.failure)"],
		},
		{
			code: "fleet-stale" as const,
			enter: Effect.fnUntraced(function* (context) {
				yield* launchRecoveryWorker();
				writeFileSync(join(context.root, "one.md"), `${context.source}\nChanged criteria.\n`);
				setLastObservation(context, { execution: "completed", output: REPORT });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "authored brief changed during execution",
			progress: (_context, before, after) => {
				expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
				expect(after.stage).toBe("reviewing");
			},
			sites: ['engine/boardBrief.ts: "fleet-stale"', "engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "approval-required" as const,
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
			restore,
			sites: ["engine/dispatchCommand.ts: failureCode(authorized.failure)"],
		},
		{
			code: "approval-required" as const,
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
			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
