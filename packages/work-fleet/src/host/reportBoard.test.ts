import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { reportFileName } from "#board/reportLinks.ts";
import type { ReportAttachments } from "#reportAttachments.ts";
import { boardFileStory, withReportWork } from "#test/boardFileStory.ts";
import { REPORT_OBSERVATION } from "#test/reportPublicationVerbs.ts";

const ORIGINAL: ReportAttachments = { files: [{ bytes: new TextEncoder().encode("Original evidence.\n"), path: "evidence.txt" }], unavailable: [] };
const EMPTY: ReportAttachments = { files: [], unavailable: [] };
const MISSING: ReportAttachments = { files: [], unavailable: [{ path: "evidence.txt", reason: "Unavailable on first retrieval" }] };
const CHANGED: ReportAttachments = { files: [{ bytes: new TextEncoder().encode("Changed evidence.\n"), path: "evidence.txt" }], unavailable: [] };

for (const boundary of ["before-publication", "lost-acknowledgement"] as const) {
	for (const [outcome, initial, later] of [
		["changed bytes", ORIGINAL, CHANGED],
		["retrieval failure", ORIGINAL, undefined],
		["attachments becoming available", MISSING, ORIGINAL],
		["an empty collection becoming populated", EMPTY, ORIGINAL],
	] as const) {
		boardFileStory.it(
			`restarts ${boundary} with ${outcome} and reuses the exact publication payload`,
			[withReportWork],
			function* ({ files, report }) {
				const root = files.root;
				expect((yield* report.publish(initial, boundary))._tag).toBe("Failure");
				const recovered = yield* report.recover(later);
				const content = readFileSync(join(root, recovered.sourcePath), "utf8");
				expect(report.collections()).toBe(1);
				expect(content).toContain(REPORT_OBSERVATION.output);
				if (initial.files.length > 0) {
					const file = initial.files[0];
					if (file === undefined) {
						throw new Error("Missing initial attachment");
					}
					expect(readFileSync(join(root, "responses", `${recovered.itemId}.attachments`, reportFileName(file.path)))).toEqual(
						Buffer.from(file.bytes),
					);
				}
				if (initial === MISSING) {
					expect(content).toContain("Unavailable on first retrieval");
				} else if (initial === EMPTY) {
					expect(content.endsWith(REPORT_OBSERVATION.output)).toBe(true);
				}
			},
		);
	}
}
