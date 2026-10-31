import { expect } from "@effect/vitest";
import { attachmentStory, oversizedFiles, reconstructed } from "#test/attachmentStory.ts";
import { refusal } from "#test/refusal.ts";

for (const kind of ["symlink", "directory", "fifo", "escape", "parent-symlink"] as const) {
	attachmentStory.it(`rejects a reconstructed ${kind} without reading a host file`, [reconstructed(kind)], function* (attachments) {
		const files = yield* refusal(attachments.files());

		expect(files).toMatch(
			new RegExp(
				`^report file failure: .*: ${kind === "escape" ? "Attachment path escapes scratch folder" : "Attachment is not a regular file inside scratch folder"}$`,
				"u",
			),
		);
	});
}
attachmentStory.it("caps aggregate attachment bytes before reading any file", [oversizedFiles], function* (attachments) {
	const files = yield* refusal(attachments.files());

	expect(files).toContain("Total report attachment bytes limit");
});
