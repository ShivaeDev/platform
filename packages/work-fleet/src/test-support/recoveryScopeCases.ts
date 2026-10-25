import { writeFileSync } from "node:fs";
import { join } from "node:path";
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
			}),
			name: "criterion needs Board data unavailable under the launch policy",
			recovery: "start-with-complete-context",
			sites: ['engine/makeLaunch.ts: "incomplete-context"'],
		},
		{
			code: "fleet-stale" as const,
			enter: Effect.fnUntraced(function* (context) {
				yield* prepareWork("one");
				writeFileSync(join(context.root, "one.md"), `${context.source.replace("kind: task", "kind: task\nowner: marvin")}\nChanged criteria.\n`);
				yield* (yield* Fleet).dispatch("one");
			}),
			name: "authored brief reassigned before dispatch",
			recovery: "start-with-current-brief",
			restore,
			sites: ["engine/dispatchCommand.ts: failureCode(authorized.failure)"],
		},
		{
			code: "approval-required" as const,
			enter: Effect.fnUntraced(function* (context) {
				yield* prepareWork("one");
				revoke(context);
				yield* (yield* Fleet).dispatch("one");
			}),
			name: "approval revoked before dispatch",
			recovery: "start-with-current-approval",
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
			recovery: "review-with-current-approval",
			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
