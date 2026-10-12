import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { oversizedAttachments, reconstructedAttachment } from "#test/reportAttachmentSafety.ts";

for (const kind of ["symlink", "directory", "fifo", "escape", "parent-symlink"] as const) {
	it.live(`rejects a reconstructed ${kind} without reading a host file`, () =>
		Effect.gen(function* () {
			const { folder, name } = yield* reconstructedAttachment(kind);
			expect(yield* reportAttachmentFiles(folder, [name]).pipe(Effect.flip)).toMatchObject({
				_tag: "ReportFileFailure",
				path: name,
				reason: kind === "escape" ? "Attachment path escapes scratch folder" : "Attachment is not a regular file inside scratch folder",
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

it.live("caps aggregate attachment bytes before reading any file", () =>
	Effect.gen(function* () {
		const folder = yield* oversizedAttachments();
		expect(yield* reportAttachmentFiles(folder, ["first", "second"]).pipe(Effect.flip)).toMatchObject({
			message: expect.stringContaining("Total report attachment bytes limit"),
		});
	}).pipe(Effect.provide(NodeServices.layer)),
);
