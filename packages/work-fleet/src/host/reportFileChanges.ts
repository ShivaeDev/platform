import { join } from "node:path";
import { Effect, FileSystem, Order } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportFileReplay } from "#host/reportFileReplay.ts";
import type { Item } from "#providers/codexProtocol.ts";
import { declaredAttachments, type ReportAttachments } from "#reportAttachments.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";

export const reportFileChanges = Effect.fn("Fleet.reportFileChanges")(function* (items: readonly (typeof Item.Type)[], output: string) {
	const state = yield* reportFileReplay(items).pipe(Effect.mapError((error) => new BadRequest({ message: error.message })));
	for (const path of declaredAttachments(output)) {
		if (!(state.contents.has(path) || state.unavailable.has(path))) {
			state.unavailable.set(path, "No file-edit attachment was exposed by this turn");
		}
	}
	const fs = yield* FileSystem.FileSystem;
	const folder = yield* fs
		.makeTempDirectoryScoped()
		.pipe(Effect.mapError((cause) => new ReportFileFailure({ cause, path: "Attachment scratch folder", reason: cause.message })));
	for (const [name, text] of state.contents) {
		const target = join(folder, name);
		yield* fs
			.makeDirectory(join(target, ".."), { recursive: true })
			.pipe(Effect.mapError((cause) => new ReportFileFailure({ cause, path: name, reason: cause.message })));
		yield* fs
			.writeFileString(target, text, { flag: "wx" })
			.pipe(Effect.mapError((cause) => new ReportFileFailure({ cause, path: name, reason: cause.message })));
	}
	const files = yield* reportAttachmentFiles(folder, [...state.contents.keys()].sort(Order.String));
	return { files, unavailable: [...state.unavailable].map(([path, reason]) => ({ path, reason })) } satisfies ReportAttachments;
});
