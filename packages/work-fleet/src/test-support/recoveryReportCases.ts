import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import type { BoardReport } from "#board/schema.ts";
import { makeReportPublication } from "#host/reportPublication.ts";
import { BoardFailure } from "#policy.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryReportCases(): readonly RecoveryCase[] {
	let publications = 0;
	let restored = false;
	function publishedReport() {
		return makeReportPublication((endpoint) =>
			Effect.succeed(JSON.stringify(endpoint.includes("matching-refs") && !restored ? [[{ ref: "refs/heads/synthetic" }]] : [[]])),
		)("example/repository", "synthetic");
	}
	function unavailableReport() {
		return makeReportPublication(() => Effect.succeed(restored ? "[[]]" : "invalid"))("example/repository", "synthetic");
	}
	function loseReceipt(receipt: BoardReport) {
		publications += 1;
		return publications === 1 ? Effect.fail(new BoardFailure({ message: "Lost report publication receipt" })) : Effect.succeed(receipt);
	}
	return [
		{
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "x".repeat(256 * 1024));
			}),
			name: "oversized completed report",
			reason: "Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.",
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
		...[
			{ check: publishedReport, name: "report published to GitHub", reason: "Report worker published to GitHub" },
			{ check: unavailableReport, name: "report GitHub observation unavailable", reason: "Report publication could not be checked on GitHub" },
		].map(
			(fault): RecoveryCase => ({
				enter: Effect.fnUntraced(function* (ctx) {
					writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
					yield* finishRecoveryWorker(ctx, "Completed findings.");
				}),
				name: fault.name,
				options: { reportPublicationQuery: fault.check },
				progress: (_ctx, before, after) => {
					expect(after.stage).toBe("completed");
					expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
					expect(after.report).toBeDefined();
				},
				reason: fault.reason,
				restore: () =>
					Effect.sync(() => {
						restored = true;
					}),
				sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
			}),
		),
		{
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "");
			}),
			name: "empty report",
			progress: (_ctx, before, after) => {
				expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
				expect(after.stage).toBe("executing");
			},
			reason: "Report worker returned empty output",
			sites: ['engine/completeReport.ts: "Report worker returned empty output"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "Completed findings.");
			}),
			name: "lost report publication receipt",
			options: {
				decorateBoard: (board) => ({ ...board, report: (work, observation) => board.report(work, observation).pipe(Effect.flatMap(loseReceipt)) }),
			},
			progress: (_ctx, before, after) => {
				expect(after.stage).toBe("completed");
				expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
				expect(publications).toBe(2);
				expect(after.report).toBeDefined();
			},
			reason: "Lost report publication receipt",
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
	];
}
