import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type { BoardReport } from "#board/schema.ts";
import { makeReportPublication } from "#host/reportPublication.ts";
import { BoardFailure } from "#policy.ts";
import { HEAD } from "#test/githubResult.ts";
import { mainObservation } from "#test/preparation.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker } from "#test/recoverySteps.ts";

export function recoveryReportCases(): readonly RecoveryCase[] {
	let publications = 0;
	const publicationReceipts: BoardReport[] = [];
	let restored = false;
	let closed = false;
	let published: boolean | undefined;
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
		publicationReceipts.push(receipt);
		publications += 1;
		return publications === 1 ? Effect.fail(new BoardFailure({ message: "Lost report publication receipt" })) : Effect.succeed(receipt);
	}
	const cases: readonly RecoveryCase[] = [
		{
			code: "report-too-large" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: report"));
				yield* finishRecoveryWorker(ctx, `${"x".repeat(256 * 1024)}\nFLEET_HEAD: ${HEAD}`);
			}),
			name: "oversized done report",
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
					writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: report"));
					yield* finishRecoveryWorker(ctx, `Completed findings.\nFLEET_HEAD: ${HEAD}`);
					if (fault.check === publishedReport) {
						closed = true;
						published = yield* publishedReport();
					}
				}),
				name: fault.name,
				observe: () => ({ published }),
				options: { reportPublicationQuery: fault.check },
				recovery: "complete-observed-report",

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
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: report"));
				yield* finishRecoveryWorker(ctx, "");
			}),
			name: "empty report",
			recovery: "replace-empty-report-worker",
			sites: ['engine/completeReport.ts: "empty-report"'],
		},
		{
			code: "board-failure" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: report"));
				yield* finishRecoveryWorker(ctx, `Completed findings.\nFLEET_HEAD: ${HEAD}`);
			}),
			name: "lost report publication receipt",
			observe: () => ({ publicationReceipts: structuredClone(publicationReceipts), publications }),
			options: {
				decorateBoard: (board) => ({ ...board, report: (work, observation) => board.report(work, observation).pipe(Effect.flatMap(loseReceipt)) }),
			},
			recovery: "recover-report-publication",
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
	return cases.map((scenario) => ({
		...scenario,
		options: {
			mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: HEAD })),
			...scenario.options,
		},
	}));
}
