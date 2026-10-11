import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";

export const linkedReportPayload = Effect.fn("ReportStory.linkedReportPayload")(function* (boundary: string, itemId: string) {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped();
	const outside = yield* fs.makeTempDirectoryScoped();
	const externalFile = join(outside, "evidence.json");
	writeFileSync(externalFile, "private");
	if (boundary === "root") {
		symlinkSync(outside, join(root, "link"));
	} else if (boundary === "directory") {
		symlinkSync(outside, join(root, ".fleet-reports"));
	} else {
		mkdirSync(join(root, ".fleet-reports"));
		symlinkSync(externalFile, join(root, ".fleet-reports", `${itemId}.json`));
	}
	return { externalFile, workspace: boundary === "root" ? join(root, "link") : root };
});
