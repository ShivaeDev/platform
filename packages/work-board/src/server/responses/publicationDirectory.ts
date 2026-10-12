import { type FileHandle, lstat, realpath } from "node:fs/promises";
import process from "node:process";
import { Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { PublicationUncertain } from "#rpc/rejections.ts";

export function directoryPath(directory: FileHandle, expected: string): string {
	return process.platform === "linux" ? `/proc/self/fd/${directory.fd}` : expected;
}

function boundaryChanged(cause?: unknown) {
	return Object.defineProperty(new Conflict({ message: "The write boundary changed." }), "cause", { value: cause });
}
function missing(cause: unknown) {
	return cause instanceof Error && "code" in cause && (cause.code === "ENOENT" || cause.code === "ENOTDIR" || cause.code === "ELOOP");
}

// Sequential on purpose: the path is observed after the handle, so a swap that lands while the handle is being read is still seen.
export async function validateDirectory(directory: FileHandle, path: string, expected: string) {
	const opened = await directory.stat();
	try {
		const current = await lstat(expected);
		if (!current.isDirectory() || current.dev !== opened.dev || current.ino !== opened.ino || (await realpath(path)) !== expected) {
			throw boundaryChanged();
		}
	} catch (cause) {
		throw missing(cause) ? boundaryChanged(cause) : cause;
	}
}

export function uncertain(cause: unknown) {
	return cause instanceof PublicationUncertain
		? cause
		: Object.defineProperty(
				new PublicationUncertain({ message: "Publication may have completed. Re-read the record identity before retrying." }),
				"cause",
				{ value: cause },
			);
}

export function publicationFailure(cause: unknown, published: boolean): never {
	throw published ? uncertain(cause) : cause;
}
