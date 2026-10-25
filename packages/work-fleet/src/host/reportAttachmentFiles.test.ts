import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { attachmentStory, oversizedFiles, reconstructed } from "#test/attachmentStory.ts";

for (const kind of ["symlink", "directory", "fifo", "escape", "parent-symlink"] as const) {
	attachmentStory.it(`rejects a reconstructed ${kind} without reading a host file`, [reconstructed(kind)], function* (attachments) {
		expect(yield* attachments.files().pipe(Effect.flip)).toMatchObject({
			_tag: "ReportFileFailure",
			reason: kind === "escape" ? "Attachment path escapes scratch folder" : "Attachment is not a regular file inside scratch folder",
		});
	});
}
attachmentStory.it("caps aggregate attachment bytes before reading any file", [oversizedFiles], function* (attachments) {
	expect(yield* attachments.files().pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("Total report attachment bytes limit") });
});
