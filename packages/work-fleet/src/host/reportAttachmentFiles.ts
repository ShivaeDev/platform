import { constants, type Stats } from "node:fs";
import { type FileHandle, lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Effect } from "effect";
import type { ReportFile } from "#host/reportDiff.ts";
import { FleetFailure } from "#policy.ts";
import { REPORT_LIMITS, reportLimit } from "#reportLimits.ts";

function inside(folder: string, file: string) {
	const name = relative(folder, file);
	return name !== "" && name !== ".." && !name.startsWith(`..${sep}`) && !isAbsolute(name);
}

async function readBounded(file: FileHandle, remaining: number) {
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const buffer = new Uint8Array(Math.min(64 * 1024, remaining - size + 1));
		const { bytesRead } = await file.read(buffer);
		if (bytesRead === 0) {
			return Buffer.concat(chunks);
		}
		size += bytesRead;
		if (size > remaining) {
			throw reportLimit("attachmentBytes");
		}
		chunks.push(buffer.subarray(0, bytesRead));
	}
}

interface AttachmentEntry {
	readonly info: Stats;
	readonly name: string;
	readonly target: string;
}

async function attachmentEntries(root: string, names: readonly string[]) {
	if (names.length > REPORT_LIMITS.attachmentCount) {
		throw reportLimit("attachmentCount");
	}
	const entries: AttachmentEntry[] = [];
	let total = 0;
	for (const name of names) {
		const target = resolve(root, name);
		if (!inside(root, target)) {
			throw new Error("Attachment path escapes scratch folder");
		}
		const info = await lstat(target);
		if (!(info.isFile() && inside(root, await realpath(target)))) {
			throw new Error("Attachment is not a regular file inside scratch folder");
		}
		total += info.size;
		if (total > REPORT_LIMITS.attachmentBytes) {
			throw reportLimit("attachmentBytes");
		}
		entries.push({ info, name, target });
	}
	return entries;
}

async function readAttachment(root: string, { info, target }: AttachmentEntry, remaining: number) {
	const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const opened = await file.stat();
		if (!(opened.isFile() && opened.dev === info.dev && opened.ino === info.ino && inside(root, await realpath(target)))) {
			throw new Error("Attachment changed after validation");
		}
		return await readBounded(file, remaining);
	} finally {
		await file.close();
	}
}

export function reportAttachmentFiles(folder: string, names: readonly string[]) {
	return Effect.tryPromise({
		catch: (error) =>
			error instanceof FleetFailure
				? error
				: new FleetFailure({ message: "Cloud report attachments must be regular files inside the scratch folder", reason: "invalid" }),
		try: async () => {
			const root = await realpath(folder);
			const entries = await attachmentEntries(root, names);
			const files: ReportFile[] = [];
			let total = 0;
			for (const entry of entries) {
				const bytes = await readAttachment(root, entry, REPORT_LIMITS.attachmentBytes - total);
				total += bytes.length;
				files.push({ bytes, path: entry.name });
			}
			return files;
		},
	});
}
