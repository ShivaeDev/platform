import { Effect, FileSystem } from "effect";
import { Publication, publishOnce } from "@shivaedev/work-board/server/publication.ts";
import { reportFileName, reportLinks } from "#board/reportLinks.ts";
import type { ReportFile } from "#reportAttachments.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";

export const publishReportAttachments = Effect.fn("Fleet.publishReportAttachments")(function* (
	root: string,
	itemId: string,
	files: readonly ReportFile[],
) {
	if (files.length === 0) {
		return "";
	}
	const path = `responses/${itemId}.attachments`;
	if (!/^fleet-report\.[a-f\d]+$/u.test(itemId)) {
		return yield* Effect.fail(new ReportFileFailure({ path, reason: "Invalid report identity" }));
	}
	const fs = yield* FileSystem.FileSystem;
	const realRoot = yield* fs.realPath(root);
	for (const file of files) {
		yield* publishOnce({ content: file.bytes, path: `${path}/${reportFileName(file.path)}`, realRoot, root }).pipe(Effect.provide(Publication.layer));
	}
	return reportLinks(itemId, files);
});
