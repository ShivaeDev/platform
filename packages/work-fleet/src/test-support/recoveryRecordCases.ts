import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryReview, finishRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryRecordCases(): readonly RecoveryCase[] {
	let context: RecoveryContext | undefined;
	let moved = false;
	return [
		{
			code: "fleet-invalid" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				const prepared = yield* prepareWork("one");
				yield* ctx.fixture.replaceRecord({ ...prepared.value, stage: "executing" });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "execution without an intent",
			progress: (_ctx, _before, after) => {
				expect(after.attempts).toHaveLength(1);
				expect(after.stage).toBe("executing");
			},
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-invalid" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "Findings");
				const stored = yield* (yield* Fleet).get("one");
				yield* ctx.fixture.replaceRecord({
					...stored.value,
					attempts: stored.value.attempts.map((attempt) => ({ ...attempt, status: "failed" })),
					stage: "adopting",
				});
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "report without completed execution",
			progress: (_ctx, before, after) => {
				expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
				expect(after.stage).toBe("executing");
			},
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "worker-receipt-missing" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryWorker(ctx);
				setLastObservation(ctx, { execution: "completed" });
				const stored = yield* (yield* Fleet).get("one");
				yield* ctx.fixture.replaceRecord({
					...stored.value,
					attempts: stored.value.attempts.map((attempt) => (attempt.role === "worker" ? { ...attempt, receipt: undefined } : attempt)),
				});
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "review without adopted worker receipt",
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-stale" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryReview(ctx);
				moved = true;
				ctx.github.state.head = MOVED;
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "delivery head changed between reads",
			options: {
				resultQuery: (...args) => {
					if (moved) {
						return Effect.succeed({ head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR });
					}
					return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
				},
			},
			progress: (_ctx, before, after) => {
				expect(after.result?.head).toBe(MOVED);
				expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
			},
			restore: () =>
				Effect.sync(() => {
					moved = false;
				}),
			sites: ["engine/makeDeliver.ts: failureCode(error)"],
		},
	];
}
