import { expect } from "@effect/vitest";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { attachmentChange } from "#test/attachmentChange.ts";
import { attachmentStory } from "#test/attachmentStory.ts";
import { addedAttachment } from "#test/reportAttachments.ts";

attachmentStory.it("replays ordered additions, updates, moves and deletes and ignores unrelated sandbox paths", [], function* (attachments) {
	const result = yield* attachments.reconstruct(
		[
			addedAttachment("nested/file.txt", "old\n"),
			attachmentChange("nested/file.txt", "update", "@@ -1 +1 @@\n-old\n+new\n"),
			attachmentChange("nested/file.txt", "update", "@@ -1 +1 @@\n-new\n+final\n", `${REPORT_ATTACHMENT_DIRECTORY}final.txt`),
			addedAttachment("gone", "gone\n"),
			attachmentChange("gone", "delete", "gone\n"),
			{ changes: [{ diff: "unrelated", kind: { type: "add" }, path: "/tmp/prototype/file.ts" }], id: "unrelated", type: "fileChange" },
		],
		"",
	);
	expect(result.unavailable).toEqual([]);
	expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([{ path: "final.txt", text: "final\n" }]);
});

attachmentStory.it("keeps the original attachment path for both null and omitted move targets", [], function* (attachments) {
	const result = yield* attachments.reconstruct(
		[
			addedAttachment("file.txt", "old\n"),
			attachmentChange("file.txt", "update", "@@ -1 +1 @@\n-old\n+updated\n"),
			{
				changes: [{ diff: "@@ -1 +1 @@\n-updated\n+final\n", kind: { type: "update" }, path: `${REPORT_ATTACHMENT_DIRECTORY}file.txt` }],
				id: "omitted-move",
				type: "fileChange",
			},
		],
		"",
	);
	expect(result.unavailable).toEqual([]);
	expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([{ path: "file.txt", text: "final\n" }]);
});

attachmentStory.it("retains a good file and records failed updates, unsafe paths and missing promised files", [], function* (attachments) {
	const result = yield* attachments.reconstruct(
		[
			addedAttachment("good", "safe"),
			addedAttachment("bad", "old\n"),
			attachmentChange("bad", "update", "@@ -1 +1 @@\n-wrong\n+new\n"),
			addedAttachment("../escape", "escaped"),
			attachmentChange("no-base", "update", "@@ -1 +1 @@\n-old\n+new\n"),
		],
		"Report\nFLEET_ATTACHMENT: missing\nFLEET_ATTACHMENT: missing",
	);
	expect(result.files.map((file) => file.path)).toEqual(["good"]);
	expect(result.unavailable.map((file) => file.path)).toEqual(["bad", "../escape", "no-base", "missing"]);
});

attachmentStory.it("does not replay declined edits, and can re-add a deleted file in the same turn", [], function* (attachments) {
	const result = yield* attachments.reconstruct(
		[
			{ ...addedAttachment("declined", "not written"), status: "declined" },
			addedAttachment("file", "old"),
			attachmentChange("file", "delete", "old"),
			addedAttachment("file", "new"),
		],
		"FLEET_ATTACHMENT: declined",
	);
	expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([{ path: "file", text: "new" }]);
	expect(result.unavailable).toEqual([{ path: "declined", reason: "No file-edit attachment was exposed by this turn" }]);
});

for (const path of [".git/config", "parent/../file", "link\\file", "file\u0000bad", "nested//file", "./file"]) {
	attachmentStory.it(`records an unsafe path without reconstructing it: ${JSON.stringify(path)}`, [], function* (attachments) {
		const result = yield* attachments.reconstruct([addedAttachment(path, "unsafe")], "");
		expect(result.files).toEqual([]);
		expect(result.unavailable).toHaveLength(1);
	});
}
