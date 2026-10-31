import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { attachmentBoundary, boardFileStory } from "#test/boardFileStory.ts";
import { refusal } from "#test/refusal.ts";
import { BINARY_FILE } from "#test/reportAttachments.ts";

const ID = `fleet-report.${revisionOf("synthetic-report")}`;
const CAPTURE = { bytes: BINARY_FILE, path: "capture.png" };
const CAPTURE_NAME = `${revisionOf(CAPTURE.path)}-${CAPTURE.path}`;
const MARKDOWN = {
	bytes: new TextEncoder().encode("---\nid: synthetic.attachment\nkind: task\nfleet: approved\n---\n# Attachment\n"),
	path: "findings.md",
};

boardFileStory.it("a Markdown attachment is stored as attachment bytes that the Board source index leaves out", [], function* ({ files }) {
	const link = yield* files.publishAttachments(ID, [MARKDOWN]);

	expect(link).toContain("findings.md.attachment");
	yield* outcomes([
		["stored bytes", () => files.attachment(ID, `${revisionOf(MARKDOWN.path)}-${MARKDOWN.path}.attachment`), Buffer.from(MARKDOWN.bytes)],
		["Board sources", () => files.documents(), []],
	]);
});

boardFileStory.it("republishing identical attachment bytes after a lost acknowledgement returns the same link", [], function* ({ files }) {
	const link = yield* files.publishAttachments(ID, [CAPTURE]);

	expect(yield* files.publishAttachments(ID, [CAPTURE])).toBe(link);
});

boardFileStory.it("different bytes for a published attachment are refused and the first bytes are kept", [], function* ({ files }) {
	yield* files.publishAttachments(ID, [CAPTURE]);

	const replaced = yield* refusal(files.publishAttachments(ID, [{ ...CAPTURE, bytes: Uint8Array.of(42) }]));

	expect(replaced).toMatch(/^report file failure: /u);
	yield* outcomes([
		["attachments", () => files.attachmentNames(ID), [CAPTURE_NAME]],
		["stored bytes", () => files.attachment(ID, CAPTURE_NAME), Buffer.from(BINARY_FILE)],
	]);
});

for (const boundary of ["root", "responses", "attachments", "file"]) {
	boardFileStory.it(
		`attachments through a symlinked ${boundary} are refused and nothing is written outside`,
		[attachmentBoundary(boundary, ID, CAPTURE_NAME)],
		function* ({ files }) {
			const published = yield* refusal(files.publishAttachments(ID, [CAPTURE]));

			expect(published).toMatch(/^report file failure: /u);
			expect(yield* files.outsideEntries()).toEqual(boundary === "root" ? ["linked-root"] : []);
		},
	);
}
