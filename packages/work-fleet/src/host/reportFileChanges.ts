import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { isFleetError } from "#errors.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportFileReplay } from "#host/reportFileReplay.ts";
import type { Item } from "#providers/codexProtocol.ts";
import { declaredAttachments, type ReportAttachments } from "#reportAttachments.ts";

export const reportFileChanges = Effect.fn("Fleet.reportFileChanges")(function* (items: readonly (typeof Item.Type)[], output: string) {
	const state = yield* Effect.try({
		catch: (error) => (isFleetError(error) ? error : new ServiceUnavailable({ message: "Attachment changes could not be reconstructed" })),
		try: () => reportFileReplay(items),
	});
	for (const path of declaredAttachments(output)) {
		if (!(state.contents.has(path) || state.unavailable.has(path))) {
			state.unavailable.set(path, "No file-edit attachment was exposed by this turn");
		}
	}
	const fs = yield* FileSystem.FileSystem;
	const folder = yield* fs.makeTempDirectoryScoped();
	for (const [name, text] of state.contents) {
		const target = join(folder, name);
		yield* fs.makeDirectory(join(target, ".."), { recursive: true });
		yield* fs.writeFileString(target, text, { flag: "wx" });
	}
	const files = yield* reportAttachmentFiles(folder, [...state.contents.keys()].sort());
	return { files, unavailable: [...state.unavailable].map(([path, reason]) => ({ path, reason })) } satisfies ReportAttachments;
});
