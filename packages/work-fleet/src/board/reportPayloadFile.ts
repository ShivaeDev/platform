import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { type ReportDirectory, validateReportDirectory, withReportDirectory } from "#reportFileDirectory.ts";
import { hasFileCode, ReportFileFailure, reportFileIo, withReportFile } from "#reportFileFailure.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";

const MAX_BYTES = REPORT_LIMITS.attachmentBytes * 2 + 512 * 1024;
function readPayload(path: string, label: string) {
	return withReportFile(
		label,
		() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
		(file) =>
			Effect.gen(function* () {
				if (!(yield* reportFileIo(label, () => file.stat())).isFile()) {
					return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Report payload must be a regular file" }));
				}
				const chunks: Uint8Array[] = [];
				let size = 0;
				for (;;) {
					const buffer = new Uint8Array(Math.min(64 * 1024, MAX_BYTES - size + 1));
					const { bytesRead } = yield* reportFileIo(label, () => file.read(buffer));
					if (bytesRead === 0) {
						break;
					}
					size += bytesRead;
					if (size > MAX_BYTES) {
						return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Report payload exceeds size limit" }));
					}
					chunks.push(buffer.subarray(0, bytesRead));
				}
				yield* reportFileIo(label, () => file.sync());
				return Buffer.concat(chunks).toString("utf8");
			}),
	).pipe(Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "ENOENT") ? Effect.succeed(undefined) : Effect.fail(error))));
}
const persist = Effect.fnUntraced(function* (directory: FileHandle, folder: string, name: string, content: string, label: string) {
	if (Buffer.byteLength(content) > MAX_BYTES) {
		return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Report payload exceeds size limit" }));
	}
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	yield* Effect.acquireUseRelease(
		reportFileIo(label, () => open(temporary, "wx", 0o600)),
		(file) =>
			Effect.gen(function* () {
				yield* reportFileIo(label, () => file.writeFile(content));
				yield* reportFileIo(label, () => file.sync());
				yield* reportFileIo(label, () => link(temporary, `${folder}/${name}`)).pipe(
					Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "EEXIST") ? Effect.void : Effect.fail(error))),
				);
				yield* reportFileIo(label, () => directory.sync());
			}),
		(file) => reportFileIo(label, () => file.close()).pipe(Effect.onExit(() => reportFileIo(label, () => unlink(temporary)))),
	);
});
const payloadInDirectory = Effect.fnUntraced(function* (
	workspace: ReportDirectory,
	directory: ReportDirectory,
	name: string,
	label: string,
	content?: string,
) {
	yield* validateReportDirectory(label, workspace);
	if (content !== undefined) {
		yield* persist(directory.file, directory.folder, name, content, label);
	}
	const payload = yield* readPayload(`${directory.folder}/${name}`, label);
	yield* reportFileIo(label, () => directory.file.sync());
	yield* validateReportDirectory(label, directory);
	yield* validateReportDirectory(label, workspace);
	return payload;
});
export const reportPayloadFile = Effect.fn("Fleet.reportPayloadFile")(function* (root: string, itemId: string, content?: string) {
	const name = `${itemId}.json`;
	const label = `.fleet-reports/${name}`;
	if (!/^fleet-report\.[a-f\d]+$/u.test(itemId)) {
		return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Invalid report identity" }));
	}
	const realRoot = yield* reportFileIo(label, () => realpath(root));
	return yield* withReportDirectory(label, root, realRoot, (workspace) =>
		Effect.gen(function* () {
			yield* reportFileIo(label, () => mkdir(`${workspace.folder}/.fleet-reports`, { mode: 0o700 })).pipe(
				Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "EEXIST") ? Effect.void : Effect.fail(error))),
			);
			yield* reportFileIo(label, () => workspace.file.sync());
			return yield* withReportDirectory(label, `${workspace.folder}/.fleet-reports`, join(realRoot, ".fleet-reports"), (directory) =>
				payloadInDirectory(workspace, directory, name, label, content),
			);
		}),
	);
});
