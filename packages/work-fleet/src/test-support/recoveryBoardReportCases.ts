import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportFileName } from "#board/reportLinks.ts";
import { originalWork } from "#engine/originalWork.ts";
import { Fleet } from "#fleet.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

const faults = [
	{ code: "board-failure" as const, kind: "context", reason: "Report needs nonempty done output and the exact current Board context." },
	{
		code: "board-failure" as const,
		kind: "publication",
		reason: "The worker report could not be recorded on Board; retry the same done attempt.",
	},
	{
		code: "board-failure" as const,
		kind: "attachments",
		reason: "Report attachments could not be recorded beside the result; retry the same done attempt",
	},
	{
		code: "board-failure" as const,
		kind: "payload-file",
		reason: "Report publication payload could not be recovered or persisted; retry the same done attempt",
	},
	{ code: "board-failure" as const, kind: "payload-content", reason: "Saved report publication payload is invalid; retain the done attempt" },
] as const;

function blockReport(root: string, itemId: string, kind: (typeof faults)[number]["kind"]) {
	let blocked: string | undefined;
	if (kind === "publication") {
		blocked = join(root, "responses", `${itemId}.md`);
		mkdirSync(blocked, { recursive: true });
	} else if (kind === "attachments") {
		const folder = join(root, "responses", `${itemId}.attachments`);
		mkdirSync(folder, { recursive: true });
		blocked = join(folder, reportFileName("findings.txt"));
		writeFileSync(blocked, "Conflicting attachment");
	} else if (kind === "payload-file") {
		blocked = join(root, ".fleet-reports");
		writeFileSync(blocked, "Blocked payload directory");
	} else if (kind === "payload-content") {
		const folder = join(root, ".fleet-reports");
		mkdirSync(folder);
		blocked = join(folder, `${itemId}.json`);
		writeFileSync(blocked, "Invalid saved payload");
	}
	return blocked;
}

export function recoveryBoardReportCases(): readonly RecoveryCase[] {
	return faults.map((fault): RecoveryCase => {
		let restored = false;
		let blocked: string | undefined;
		return {
			code: fault.code,
			enter: Effect.fnUntraced(function* (ctx) {
				writeFileSync(join(ctx.root, "one.md"), ctx.source.replace("fleet: approved", "fleet: approved\ndelivers: report"));
				yield* launchRecoveryWorker();
				const fleet = yield* Fleet;
				const record = (yield* fleet.get("one")).value;
				const work = originalWork(record);
				const receipt = record.attempts.at(-1)?.receipt;
				if (work === undefined || receipt === undefined) {
					return yield* Effect.die("Missing report identity");
				}
				const { itemId } = reportIdentity(work, receipt);
				blocked = blockReport(ctx.root, itemId, fault.kind);
				setLastObservation(ctx, { execution: "completed", output: "Completed findings." });
				yield* fleet.reconcile("one");
			}),
			name: `production Board report ${fault.kind} failure`,
			options: {
				decorateBoard: (board) => ({
					...board,
					report: (work, observation) =>
						board.report(fault.kind === "context" && !restored ? { ...work, revision: "wrong-revision" } : work, observation),
				}),
				reportAttachmentsQuery: () => Effect.succeed({ files: [{ bytes: Buffer.from("Exact findings"), path: "findings.txt" }], unavailable: [] }),
				reportPublicationQuery: () => Effect.succeed(false),
			},
			recovery: "record-board-report",
			restore: () =>
				Effect.sync(() => {
					restored = true;
					if (blocked !== undefined) {
						rmSync(blocked, { recursive: true });
					}
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		};
	});
}
