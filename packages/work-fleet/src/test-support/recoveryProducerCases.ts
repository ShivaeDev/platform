import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { ConnectionError, SqlError } from "effect/sql/SqlError";
import { Fleet } from "#fleet.ts";
import { GithubApi } from "#host/githubApi.ts";
import { prepareWork } from "#test/engine.ts";
import { githubCliApi } from "#test/githubApi.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryProducerCases(): readonly RecoveryCase[] {
	let restored = false;
	let context: RecoveryContext | undefined;
	const failedHttp = githubCliApi(new Map([["synthetic", "{}"]]), 503);
	const failedProductionRead = GithubApi.pipe(
		Effect.flatMap((github) => github.get("synthetic")),
		Effect.provide(failedHttp.layer),
		Effect.andThen(Effect.die("Unexpected GitHub success")),
	);

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
					!restored && record.step === "reviewing"
						? new SqlError({ reason: new ConnectionError({ cause: new Error("Repository unavailable") }) })
						: undefined,
			},
			recovery: "review-after-integration-recovery",

			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "board-failure" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* terminal(ctx);
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: invalid"));
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "production Board deliverable metadata invalid",
			recovery: "review-after-integration-recovery",
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
					restored && context !== undefined ? context.github.resultQuery(work, observation) : failedProductionRead,
			},
			recovery: "review-after-integration-recovery",

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
			recovery: "review-after-integration-recovery",
			restore,
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-denied" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				const record = (yield* prepareWork("one")).value;
				yield* ctx.fixture.replaceRecord({ ...record, step: "repairing" });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "repair lacks an existing worker",
			recovery: "start-missing-worker",
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
