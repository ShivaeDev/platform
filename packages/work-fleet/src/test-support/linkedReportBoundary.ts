import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";

export const linkedReportBoundary = Effect.fn("ReportStory.linkedReportBoundary")(function* (boundary: string, itemId: string, name: string) {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped();
	const outside = yield* fs.makeTempDirectoryScoped();
	const responses = join(root, "responses");
	const attachments = join(responses, `${itemId}.attachments`);
	let workspace = root;
	if (boundary === "root") {
		workspace = join(outside, "linked-root");
		symlinkSync(root, workspace);
	} else if (boundary === "responses") {
		symlinkSync(outside, responses);
	} else {
		mkdirSync(responses);
		if (boundary === "attachments") {
			symlinkSync(outside, attachments);
		} else {
			mkdirSync(attachments);
			symlinkSync(join(outside, "target"), join(attachments, name));
		}
	}
	return { outside, workspace };
});
