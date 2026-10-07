import { type FileHandle, lstat, realpath } from "node:fs/promises";
import { ResponseFailed } from "#browser/responses/schema.ts";

export function directoryPath(directory: FileHandle, expected: string): string {
	return process.platform === "linux" ? `/proc/self/fd/${directory.fd}` : expected;
}

export async function validateDirectory(directory: FileHandle, path: string, expected: string) {
	const [opened, current, resolved] = await Promise.all([directory.stat(), lstat(expected), realpath(path)]);
	if (!current.isDirectory() || current.dev !== opened.dev || current.ino !== opened.ino || resolved !== expected) {
		throw new ResponseFailed({ code: "Conflict", message: "The write boundary changed." });
	}
}

export function uncertain(cause: unknown) {
	return new ResponseFailed({ cause, code: "Uncertain", message: "Publication may have completed. Re-read the record identity before retrying." });
}

export function publicationFailure(cause: unknown, published: boolean): never {
	throw published ? uncertain(cause) : cause;
}
