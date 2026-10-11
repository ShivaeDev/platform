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
				message: "Cloud report attachments must be regular files inside the scratch folder",
				reason: "invalid",
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
