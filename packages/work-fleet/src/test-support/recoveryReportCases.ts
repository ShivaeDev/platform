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
	let closed = false;
	function publicationResponse(endpoint: string) {
		if (endpoint.includes("matching-refs")) {
			return closed ? [[]] : [[{ ref: "refs/heads/synthetic" }]];
		}
		return endpoint.includes("state=all")
			? [[{ "html_url": "https://github.com/example/repository/pull/7", state: closed ? "closed" : "open" }]]
			: [[]];
	}
	function publishedReport() {
		return makeReportPublication((endpoint) => Effect.succeed(JSON.stringify(publicationResponse(endpoint))))("example/repository", "synthetic");
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
			code: "report-too-large" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "x".repeat(256 * 1024));
			}),
			name: "oversized completed report",
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		...[
			{
				check: publishedReport,
				code: "report-published" as const,
				name: "closed published report PR with deleted branch",
				reason: "Report worker published to GitHub",
			},
			{
				check: unavailableReport,
				code: "fleet-integration" as const,
				name: "report GitHub observation unavailable",
				reason: "Report publication could not be checked on GitHub",
			},
		].map(
			(fault): RecoveryCase => ({
				code: fault.code,
				enter: Effect.fnUntraced(function* (ctx) {
					writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
					yield* finishRecoveryWorker(ctx, "Completed findings.");
					if (fault.check === publishedReport) {
						closed = true;
						expect(yield* publishedReport()).toBe(true);
					}
				}),
				name: fault.name,
				options: { reportPublicationQuery: fault.check },
				progress: (_ctx, before, after) => {
					expect(after.stage).toBe("completed");
					expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
					expect(after.report).toBeDefined();
				},

				restore: () =>
					Effect.sync(() => {
						restored = true;
					}),
				sites: ["engine/reconcileCommand.ts: failureCode(error)"],
			}),
		),
		{
			code: "empty-report" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report"));
				yield* finishRecoveryWorker(ctx, "");
			}),
			name: "empty report",
			progress: (_ctx, before, after) => {
				expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
				expect(after.stage).toBe("executing");
			},
			sites: ['engine/completeReport.ts: "empty-report"'],
		},
		{
			code: "board-failure" as const,
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
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
