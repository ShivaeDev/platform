import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { HEAD } from "#test/githubResult.ts";
import { addedAttachment } from "#test/reportAttachments.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";
const cases = [
	{ items: () => [addedAttachment("../escape", "safe")], name: "path escape", reason: "Unsafe attachment path" },
	{
		items: () => [addedAttachment("file.txt", "x".repeat(REPORT_LIMITS.diffBytes + 1))],
		name: "diff size",
		reason: "Downloaded report diff size limit",
	},
	{
		items: () => [{ id: "large", text: "x".repeat(REPORT_LIMITS.downloadBytes + 1), type: "reasoning" }],
		name: "download size",
		reason: "Downloaded report task size limit",
	},
	{
		items: () => Array.from({ length: REPORT_LIMITS.attachmentCount + 1 }, (_, i) => addedAttachment(`file-${i}`, "safe")),
		name: "attachment count",
		reason: "Report attachment count limit",
	},
	{ items: () => [], name: "shell-only or missing attachment", reason: "No file-edit attachment was exposed" },
	{ items: () => [], name: "unavailable server", reason: "Synthetic attachment retrieval unavailable", reject: true },
];

import { reportDownload } from "#test/hostReportTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

for (const scenario of cases) {
	host.it(
		`publishes report text and records ${scenario.name} without attachments`,
		[boardWork({ "research.md": SOURCE }), reportDownload(scenario.items(), "none", scenario.reject)],
		function* (daemon) {
			const started = yield* daemon.approve("research");
			const observation = daemon.providerObservations()[0];
			if (observation === undefined) {
				throw new Error("No report worker");
			}
			const output = `Report with attachments\nFLEET_ATTACHMENT: file.txt\nFLEET_HEAD: ${HEAD}`;
			daemon.finishTurn(started.value, output);
			const result = yield* daemon.reconcile("research");

			expect(result.step).toBe("done");
			expect(result.decision).toBeUndefined();
			const report = result.report;
			if (report === undefined) {
				return yield* Effect.die(new Error("No report result"));
			}
			const content = daemon.readBoard(report.sourcePath);
			expect(content).toContain(output);
			expect(content).toContain("## Unavailable attachments");
			expect(content).toContain(scenario.reason);
			expect(daemon.providerArchives()).toEqual([observation.receipt.sessionId]);
			expect(daemon.boardFiles("responses").filter((file) => file.startsWith("fleet-report."))).toEqual([`${report.itemId}.md`]);
		},
	);
}
