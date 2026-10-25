import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { PUBLISHED_REPORT } from "#host/reportBoard.ts";
import { HEAD } from "#test/githubResult.ts";
import { attachmentItems, REPORT_FILES } from "#test/reportAttachments.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";
const OUTPUT = `The report stays private to Board.\nFLEET_HEAD: ${HEAD}`;

import { reportDownload } from "#test/hostReportTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

for (const attachments of [true, false]) {
	host.it(
		`completes a report ${attachments ? "with downloaded text and encoded binary files beside the result" : "without attachments"}`,
		[boardWork({ "research.md": SOURCE }), reportDownload(attachments ? attachmentItems() : [])],
		function* (daemon) {
			const started = yield* daemon.approve("research");
			const observation = daemon.providerObservations()[0];
			if (observation === undefined) {
				throw new Error("No report worker");
			}
			daemon.finishTurn(started.value, OUTPUT);
			const result = yield* daemon.reconcile("research");
			expect(result.step).toBe("done");
			expect(daemon.providerArchives()).toEqual([observation.receipt.sessionId]);
			const report = result.report;
			if (report === undefined) {
				return yield* Effect.die(new Error(result.decision?.reason ?? "No report result"));
			}
			const observed = daemon.reportFiles(report);
			expect(observed.content).toContain(OUTPUT);
			if (attachments) {
				expect(observed.files).toHaveLength(Object.keys(REPORT_FILES).length);
				for (const [name, bytes] of Object.entries(REPORT_FILES)) {
					expect(observed.files.find((file) => file.name.endsWith(`-${name}`))?.bytes).toEqual(Buffer.from(bytes));
					expect(observed.content).toContain(name);
				}
			} else {
				expect(observed.responses).toEqual([`${report.itemId}.md`]);
				expect(observed.content.endsWith(OUTPUT)).toBe(true);
			}
			expect(
				daemon
					.downloadRequests()
					.filter((request) => request.method === "thread/items/list")
					.map((request) => request.params),
			).toEqual([{ cursor: null, limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId }]);
			expect(daemon.publicationRequests()).toHaveLength(4);
			expect((yield* daemon.reconcile("research")).report).toEqual(report);
			expect(daemon.providerLaunches()).toHaveLength(1);
			expect(daemon.providerCalls()).toHaveLength(2);
			expect(daemon.readBoard("research.md")).toBe(
				SOURCE.replace("delivers: report\n", 'delivers: report\nstatus: done\nnext_action: "Done; report recorded."\n'),
			);
		},
	);
}
for (const published of ["branch", "pr"] as const) {
	for (const output of [OUTPUT, "FLEET_QUESTION: Which approach?"]) {
		host.it(
			`rejects a published ${published} after a report turn${output === OUTPUT ? "" : " with a question and changed context"}`,
			[boardWork({ "research.md": SOURCE }), reportDownload(attachmentItems(), published)],
			function* (daemon) {
				const started = yield* daemon.approve("research");
				daemon.finishTurn(started.value, output);
				if (output !== OUTPUT) {
					daemon.writeBoard("research.md", SOURCE.replace("delivers: report\n", ""));
				}
				const result = yield* daemon.reconcile("research");
				expect(result.step).toBe("waiting");
				expect(result.decision?.reason).toBe(PUBLISHED_REPORT);
				expect(result.decision?.worker).toBeUndefined();
				expect(result.report).toBeUndefined();
				expect(daemon.providerArchives()).toEqual([]);
				expect(daemon.downloadRequests()).toEqual([]);
				expect(daemon.publicationRequests()).toHaveLength(2);
				expect(daemon.boardFiles("responses").some((file) => file.startsWith("fleet-report."))).toBe(false);
			},
		);
	}
}
