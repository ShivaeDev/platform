import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { attachmentBoundary, boardFileStory } from "#test/boardFileStory.ts";
import { BINARY_FILE } from "#test/reportAttachments.ts";

const ID = `fleet-report.${revisionOf("synthetic-report")}`;
const FILE = { bytes: BINARY_FILE, path: "capture.png" };
const NAME = `${revisionOf(FILE.path)}-${FILE.path}`;

boardFileStory.it("keeps Markdown attachment bytes outside Board's source index", [], function* ({ files }) {
	const { root } = files;
	const bytes = new TextEncoder().encode("---\nid: synthetic.attachment\nkind: task\nfleet: approved\n---\n# Attachment\n");
	const path = "findings.md";
	const link = yield* files.publishAttachments(ID, [{ bytes, path }]);
	expect(link).toContain("findings.md.attachment");
	expect(readFileSync(join(root, "responses", `${ID}.attachments`, `${revisionOf(path)}-${path}.attachment`))).toEqual(Buffer.from(bytes));
	expect(yield* files.documents()).toEqual([]);
});

boardFileStory.it("reuses identical bytes after a lost acknowledgement and refuses replacement", [], function* ({ files }) {
	const { root } = files;
	const suffix = yield* files.publishAttachments(ID, [FILE]);
	expect(yield* files.publishAttachments(ID, [FILE])).toBe(suffix);
	expect(yield* files.publishAttachments(ID, [{ ...FILE, bytes: Uint8Array.of(42) }]).pipe(Effect.flip)).toMatchObject({ _tag: "ReportFileFailure" });
	const folder = join(root, "responses", `${ID}.attachments`);
	expect(readdirSync(folder)).toEqual([NAME]);
	expect(readFileSync(join(folder, NAME))).toEqual(Buffer.from(BINARY_FILE));
});

for (const boundary of ["root", "responses", "attachments", "file"]) {
	boardFileStory.it(`refuses symlinks at the ${boundary} boundary`, [attachmentBoundary(boundary, ID, NAME)], function* ({ files }) {
		const { outside } = files;
		expect(yield* files.publishAttachments(ID, [FILE]).pipe(Effect.flip)).toMatchObject({ _tag: "ReportFileFailure" });
		expect(readdirSync(outside)).toEqual(boundary === "root" ? ["linked-root"] : []);
	});
}
