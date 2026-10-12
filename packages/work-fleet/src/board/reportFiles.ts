import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { reportFileName, reportLinks } from "#board/reportLinks.ts";
import type { ReportFile } from "#reportAttachments.ts";
import { type ReportDirectory, validateReportDirectory, withReportDirectory } from "#reportFileDirectory.ts";
import { hasFileCode, ReportFileFailure, reportFileIo, withReportFile } from "#reportFileFailure.ts";

function ensureDirectory(path: string, label: string) {
	return reportFileIo(label, () => mkdir(path, { mode: 0o700 })).pipe(
		Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "EEXIST") ? Effect.void : Effect.fail(error))),
	);
}
function existingFile(path: string, bytes: Uint8Array, label: string) {
	return withReportFile(
		label,
		() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
		(existing) =>
			Effect.gen(function* () {
				if (
					!(
						(yield* reportFileIo(label, () => existing.stat())).isFile()
						&& Buffer.from(bytes).equals(yield* reportFileIo(label, () => existing.readFile()))
					)
				) {
					return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Attachment identity already contains different bytes" }));
				}
				yield* reportFileIo(label, () => existing.sync());
			}),
	);
}
const publishFile = Effect.fnUntraced(function* (directory: FileHandle, folder: string, name: string, bytes: Uint8Array, label: string) {
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	yield* Effect.acquireUseRelease(
		reportFileIo(label, () => open(temporary, "wx", 0o600)),
		(file) =>
			Effect.gen(function* () {
				yield* reportFileIo(label, () => file.writeFile(bytes));
				yield* reportFileIo(label, () => file.sync());
				yield* reportFileIo(label, () => link(temporary, `${folder}/${name}`)).pipe(
					Effect.catchTag("ReportFileFailure", (error) =>
						hasFileCode(error.cause, "EEXIST") ? existingFile(`${folder}/${name}`, bytes, label) : Effect.fail(error),
					),
				);
				yield* reportFileIo(label, () => directory.sync());
			}),
		(file) => reportFileIo(label, () => file.close()).pipe(Effect.onExit(() => reportFileIo(label, () => unlink(temporary)))),
	);
});

function publishAttachments(workspace: ReportDirectory, responses: ReportDirectory, itemId: string, files: readonly ReportFile[], label: string) {
	const folderName = `${itemId}.attachments`;
	return Effect.gen(function* () {
		yield* ensureDirectory(`${responses.folder}/${folderName}`, label);
		yield* reportFileIo(label, () => responses.file.sync());
		return yield* withReportDirectory(label, `${responses.folder}/${folderName}`, join(responses.expected, folderName), (directory) =>
			Effect.gen(function* () {
				for (const file of files) {
					yield* validateReportDirectory(file.path, workspace);
					yield* validateReportDirectory(file.path, responses);
					yield* validateReportDirectory(file.path, directory);
					yield* publishFile(directory.file, directory.folder, reportFileName(file.path), file.bytes, file.path);
				}
				yield* validateReportDirectory(label, directory);
				yield* validateReportDirectory(label, workspace);
				yield* validateReportDirectory(label, responses);
				return reportLinks(itemId, files);
			}),
		);
	});
}

export const reportFiles = Effect.fn("Fleet.reportFiles")(function* (root: string, itemId: string, files: readonly ReportFile[]) {
	if (files.length === 0) {
		return "";
	}
	const label = `responses/${itemId}.attachments`;
	if (!/^fleet-report\.[a-f\d]+$/u.test(itemId)) {
		return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Invalid report identity" }));
	}
	const realRoot = yield* reportFileIo(label, () => realpath(root));
	return yield* withReportDirectory(label, root, realRoot, (workspace) =>
		Effect.gen(function* () {
			yield* ensureDirectory(`${workspace.folder}/responses`, label);
			yield* reportFileIo(label, () => workspace.file.sync());
			return yield* withReportDirectory(label, `${workspace.folder}/responses`, join(realRoot, "responses"), (responses) =>
				publishAttachments(workspace, responses, itemId, files, label),
			);
		}),
	);
});
