import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { ReportAttachments } from "#reportAttachments.ts";
import { boardFileStory, withReportWork } from "#test/boardFileStory.ts";
import { REPORT_OBSERVATION } from "#test/reportPublicationVerbs.ts";

const ORIGINAL_BYTES = new TextEncoder().encode("Original evidence.\n");
const ORIGINAL: ReportAttachments = { files: [{ bytes: ORIGINAL_BYTES, path: "evidence.txt" }], unavailable: [] };
const EMPTY: ReportAttachments = { files: [], unavailable: [] };
const MISSING: ReportAttachments = { files: [], unavailable: [{ path: "evidence.txt", reason: "Unavailable on first retrieval" }] };
const CHANGED: ReportAttachments = { files: [{ bytes: new TextEncoder().encode("Changed evidence.\n"), path: "evidence.txt" }], unavailable: [] };

const CHANGES = [
	["changed bytes", ORIGINAL, CHANGED, "attachment", Buffer.from(ORIGINAL_BYTES)],
	["a failed retrieval", ORIGINAL, undefined, "attachment", Buffer.from(ORIGINAL_BYTES)],
	["attachments becoming available", MISSING, ORIGINAL, "report", expect.stringContaining("Unavailable on first retrieval")],
	["an empty collection becoming populated", EMPTY, ORIGINAL, "report", expect.stringMatching(new RegExp(`${REPORT_OBSERVATION.output}$`, "u"))],
] as const;

for (const [boundary, [change, initial, later, evidence, expected]] of (["before-publication", "lost-acknowledgement"] as const).flatMap((side) =>
	CHANGES.map((row) => [side, row] as const),
)) {
	boardFileStory.it(
		`a report restarted ${boundary} after ${change} collects attachments once and republishes its first ${evidence}`,
		[withReportWork],
		function* ({ files, report }) {
			expect(yield* report.publish(initial, boundary)).not.toBe("accepted");

			const recovered = yield* report.recover(later);

			yield* outcomes([
				["attachment collections", () => report.collections(), 1],
				["report output", () => files.source(recovered.sourcePath), expect.stringContaining(REPORT_OBSERVATION.output)],
				[`first ${evidence}`, () => files.evidence(recovered, evidence), expected],
			]);
		},
	);
}
