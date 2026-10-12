import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ConnectionError, SqlError } from "effect/unstable/sql/SqlError";
import { Fleet } from "#fleet.ts";
import { githubRead } from "#host/githubRead.ts";
import { prepareWork } from "#test/engine.ts";
import { githubCli } from "#test/githubCli.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryProducerCases(): readonly RecoveryCase[] {
	let restored = false;
	let context: RecoveryContext | undefined;
	const failedCli = githubCli(new Map(), 1);
	const progress: NonNullable<RecoveryCase["progress"]> = (_ctx, _before, after) => {
		expect(after.attempts.at(-1)?.role).toBe("reviewer");
		expect(after.stage).toBe("reviewing");
	};
	function restore() {
		return Effect.sync(() => {
			restored = true;
		});
	}
	const terminal = Effect.fnUntraced(function* (ctx: RecoveryContext) {
		yield* launchRecoveryWorker();
		context = ctx;
		setLastObservation(ctx, { execution: "completed", output: REPORT });
	});
	return [
		{
			code: "integration-failure" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "unclassified repository write failure",
			options: {
				writeFailure: (record) =>
					!restored && record.stage === "reviewing"
						? new SqlError({ reason: new ConnectionError({ cause: new Error("Repository unavailable") }) })
						: undefined,
			},
			progress,

			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "board-failure" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: invalid"));
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "production Board deliverable metadata invalid",
			progress,
			restore: (ctx) =>
				Effect.sync(() => {
					writeFileSync(join(ctx.root, "one.md"), ctx.source);
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "production GitHub process reader unavailable",
			options: {
				resultQuery: (work, observation) =>
					restored && context !== undefined
						? context.github.resultQuery(work, observation)
						: githubRead(["api", "synthetic"]).pipe(Effect.provide(failedCli.layer), Effect.andThen(Effect.die("Unexpected GitHub success"))),
			},
			progress,

			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "approval-required" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "production review admission requires approval",
			options: {
				decorateBoard: (board) => ({
					...board,
					get: (id) => board.get(id).pipe(Effect.map((work) => ({ ...work, approved: context === undefined || restored }))),
				}),
			},
			progress,
			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-denied" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				const fleet = yield* Fleet;
				const record = (yield* fleet.get("one")).value;
				yield* ctx.fixture.replaceRecord({ ...record, stage: "repairing" });
				yield* fleet.reconcile("one");
			}),
			name: "repair waits for the active worker to finish",
			progress,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-denied" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				const record = (yield* prepareWork("one")).value;
				yield* ctx.fixture.replaceRecord({ ...record, stage: "repairing" });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "repair lacks an existing worker",
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("executing");
				expect(after.attempts).toHaveLength(1);
			},
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
