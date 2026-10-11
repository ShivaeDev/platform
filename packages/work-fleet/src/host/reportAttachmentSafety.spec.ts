import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { withHost } from "#test/fleetHost.ts";
import { attachmentBoard, attachmentDiff, taskDownload } from "#test/reportAttachments.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
const SAFE = new TextEncoder().encode("safe\n");
const DIFF = attachmentDiff({ "file.txt": SAFE });
const cases = [
	{
		diff: () => DIFF.replace("new file mode 100644", "new file mode 100644\nnew file mode 120000"),
		name: "dual-mode symlink",
		reason: "newly created regular files",
	},
	{ diff: () => DIFF.replaceAll("file.txt", "../escape"), name: "path escape", reason: "unsafe attachment paths" },
	{ diff: () => "x".repeat(REPORT_LIMITS.diffBytes + 1), name: "diff size", reason: "Downloaded report diff size limit" },
	{ diff: () => "x".repeat(REPORT_LIMITS.downloadBytes + 1), name: "download size", reason: "Downloaded report task size limit" },
	{
		diff: () => attachmentDiff(Object.fromEntries(Array.from({ length: REPORT_LIMITS.attachmentCount + 1 }, (_, i) => [`file-${i}`, SAFE]))),
		name: "attachment count",
		reason: "Report attachment count limit",
	},
	{
		diff: () =>
			attachmentDiff({
				"first.bin": new Uint8Array(REPORT_LIMITS.attachmentBytes / 2),
				"second.bin": new Uint8Array(REPORT_LIMITS.attachmentBytes / 2 + 1),
			}),
		name: "total attachment bytes",
		reason: "Total report attachment bytes limit",
	},
];

describe("Unsafe report attachments", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
	for (const scenario of cases) {
		test(`sends ${scenario.name} to needs-human before writing a report or attachment`, function* () {
			const download = yield* taskDownload(scenario.diff());
			yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
				Effect.gen(function* () {
					const collector = attachmentBoard(fixture.host.boardDir, download);
					const parts = { ...fixture.parts, board: collector.board };
					yield* dispatchWork(fixture.host, "research", parts);
					const observation = [...fixture.provider.observations.values()][0];
					if (observation === undefined) {
						return yield* Effect.die(new Error("No report worker"));
					}
					fixture.provider.observations.set(observation.receipt.turnId, {
						...observation,
						execution: "completed",
						output: "Report with attachments",
					});
					const result = yield* Effect.gen(function* () {
						return yield* (yield* Fleet).reconcile("research");
					}).pipe(Effect.provide(hostLayer(fixture.host, parts)));
					expect(result.value.stage).toBe("needs-human");
					expect(result.value.decision?.reason).toContain(scenario.reason);
					expect(result.value.report).toBeUndefined();
					expect(fixture.provider.archived).toEqual([]);
					expect(readdirSync(join(fixture.host.boardDir, "responses")).some((file) => file.startsWith("fleet-report."))).toBe(false);
				}),
			);
		}, 30_000);
	}
});
