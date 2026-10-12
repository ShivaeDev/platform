import { constants, type Stats } from "node:fs";
import { type FileHandle, lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Effect } from "effect";
import type { ReportFile } from "#reportAttachments.ts";
import { ReportFileFailure, reportFileIo, withReportFile } from "#reportFileFailure.ts";
import { REPORT_LIMITS, reportLimit } from "#reportLimits.ts";

function inside(folder: string, file: string) {
	const name = relative(folder, file);
	return name !== "" && name !== ".." && !name.startsWith(`..${sep}`) && !isAbsolute(name);
}

const readBounded = Effect.fnUntraced(function* (path: string, file: FileHandle, remaining: number) {
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const buffer = new Uint8Array(Math.min(64 * 1024, remaining - size + 1));
		const { bytesRead } = yield* reportFileIo(path, () => file.read(buffer));
		if (bytesRead === 0) {
			return Buffer.concat(chunks);
		}
		size += bytesRead;
		if (size > remaining) {
			return yield* Effect.fail(new ReportFileFailure({ path, reason: reportLimit("attachmentBytes").message }));
		}
		chunks.push(buffer.subarray(0, bytesRead));
	}
});

interface AttachmentEntry {
	readonly info: Stats;
	readonly name: string;
	readonly target: string;
}

const attachmentEntries = Effect.fnUntraced(function* (root: string, names: readonly string[]) {
	if (names.length > REPORT_LIMITS.attachmentCount) {
		return yield* Effect.fail(
			new ReportFileFailure({ path: names[REPORT_LIMITS.attachmentCount] ?? root, reason: reportLimit("attachmentCount").message }),
		);
	}
	const entries: AttachmentEntry[] = [];
	let total = 0;
	for (const name of names) {
		const target = resolve(root, name);
		if (!inside(root, target)) {
			return yield* Effect.fail(new ReportFileFailure({ path: name, reason: "Attachment path escapes scratch folder" }));
		}
		const info = yield* reportFileIo(name, () => lstat(target));
		if (!(info.isFile() && inside(root, yield* reportFileIo(name, () => realpath(target))))) {
			return yield* Effect.fail(new ReportFileFailure({ path: name, reason: "Attachment is not a regular file inside scratch folder" }));
		}
		total += info.size;
		if (total > REPORT_LIMITS.attachmentBytes) {
			return yield* Effect.fail(new ReportFileFailure({ path: name, reason: reportLimit("attachmentBytes").message }));
		}
		entries.push({ info, name, target });
	}
	return entries;
});

function readAttachment(root: string, { info, name, target }: AttachmentEntry, remaining: number) {
	return withReportFile(
		name,
		() => open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
		(file) =>
			Effect.gen(function* () {
				const opened = yield* reportFileIo(name, () => file.stat());
				if (
					!(opened.isFile() && opened.dev === info.dev && opened.ino === info.ino && inside(root, yield* reportFileIo(name, () => realpath(target))))
				) {
					return yield* Effect.fail(new ReportFileFailure({ path: name, reason: "Attachment changed after validation" }));
				}
				return yield* readBounded(name, file, remaining);
			}),
	);
}

export const reportAttachmentFiles = Effect.fn("Fleet.reportAttachmentFiles")(function* (folder: string, names: readonly string[]) {
	const root = yield* reportFileIo(folder, () => realpath(folder));
	const entries = yield* attachmentEntries(root, names);
	const files: ReportFile[] = [];
	let total = 0;
	for (const entry of entries) {
		const bytes = yield* readAttachment(root, entry, REPORT_LIMITS.attachmentBytes - total);
		total += bytes.length;
		files.push({ bytes, path: entry.name });
	}
	return files;
});
