import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import { HEAD } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryReview, finishRecoveryWorker, launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

const readerUnavailable = new ServiceUnavailable({ message: "Synthetic result reader unavailable" });
export function recoveryIntegrationCases(): readonly RecoveryCase[] {
	let context: RecoveryContext | undefined;
	let invalidChecks = true;
	let calls = 0;
	return [
		{
			code: "fleet-invalid" as const,
			enter: finishRecoveryReview,
			name: "required validation failed",
			options: {
				checksQuery: (result) =>
					Effect.sync(() => {
						calls += 1;
						return { evidence: ["Required check"], head: result.head, passed: !invalidChecks };
					}),
			},
			progress: (_ctx, _before, after) => {
				expect(calls).toBe(2);
				expect(after.stage).toBe("completed");
			},
			restore: (ctx) =>
				Effect.sync(() => {
					invalidChecks = false;
					ctx.github.state.status = "MERGED";
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "result-identity-changed" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryReview(ctx);
			}),
			name: "result identity changed",
			options: {
				resultQuery: (...args) => {
					calls += 1;
					if (calls > 1) {
						return Effect.succeed({ evidence: ["Different result"], head: HEAD, kind: "no-change" });
					}
					return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
				},
			},
			sites: ['engine/refreshReviewResult.ts: "result-identity-changed"'],
		},
		{
			code: "fleet-invalid" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed" });
				const fleet = yield* Fleet;
				const active = yield* fleet.get("one");
				yield* ctx.fixture.replaceRecord({
					...active.value,
					attempts: active.value.attempts.map((attempt) => ({ ...attempt, output: "", receipt: undefined, status: "completed" })),
					stage: "adopting",
				});
				yield* fleet.reconcile("one");
			}),
			name: "completed worker lacks receipt",
			progress: (_ctx, before, after) => {
				expect(after.attempts[0]?.receipt).toBeDefined();
				expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
				expect(after.result?.kind).toBe("no-change");
			},
			restore: (ctx) =>
				Effect.sync(() => {
					setLastObservation(ctx, { execution: "completed", output: `Recovered report.\nFLEET_HEAD: ${HEAD}\nFLEET_PR: none` });
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryWorker(ctx);
			}),
			name: "result reader unavailable",
			options: {
				resultQuery: (...args) => {
					if (invalidChecks) {
						return Effect.fail(readerUnavailable);
					}
					return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
				},
			},
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("reviewing");
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			restore: () =>
				Effect.sync(() => {
					invalidChecks = false;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
