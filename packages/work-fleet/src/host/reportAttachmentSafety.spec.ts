import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { dispatchWork } from "#test/dispatchWork.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { addedAttachment, attachmentBoard, turnDownload } from "#test/reportAttachments.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
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

describe("Unavailable report attachments", () => {
	const test = postgresTests("live");
	for (const scenario of cases) {
		test(`publishes report text and records ${scenario.name} without attachments`, function* () {
			const download = yield* turnDownload(scenario.items(), scenario.reject);
			yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
				Effect.gen(function* () {
					const collector = attachmentBoard(fixture.host.boardDir, download);
					const parts = { ...fixture.parts, board: collector.board };
					yield* dispatchWork(fixture.host, "research", parts);
					const observation = [...fixture.provider.observations.values()][0];
					if (observation === undefined) {
						return yield* Effect.die(new Error("No report worker"));
					}
					const output = "Report with attachments\nFLEET_ATTACHMENT: file.txt";
					fixture.provider.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output });
					const result = yield* Effect.gen(function* () {
						return yield* (yield* Fleet).reconcile("research");
					}).pipe(Effect.provide(hostLayer(fixture.host, parts)));
					expect(result.value.stage).toBe("completed");
					expect(result.value.decision).toBeUndefined();
					const report = result.value.report;
					if (report === undefined) {
						return yield* Effect.die(new Error("No report result"));
					}
					const content = readFileSync(join(fixture.host.boardDir, report.sourcePath), "utf8");
					expect(content).toContain(output);
					expect(content).toContain("## Unavailable attachments");
					expect(content).toContain(scenario.reason);
					expect(fixture.provider.archived).toEqual([observation.receipt.sessionId]);
					expect(readdirSync(join(fixture.host.boardDir, "responses")).filter((file) => file.startsWith("fleet-report."))).toEqual([
						`${report.itemId}.md`,
					]);
				}),
			);
		});
	}
});
