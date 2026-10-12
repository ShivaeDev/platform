import type { FileHandle } from "node:fs/promises";
import { Effect, Schema } from "effect";

export class ReportFileFailure extends Schema.TaggedError<ReportFileFailure>()("ReportFileFailure", {
	cause: Schema.optional(Schema.Unknown),
	path: Schema.String,
	reason: Schema.String,
}) {
	override get message() {
		return `${this.path}: ${this.reason}`;
	}
}

export function reportFileIo<A>(path: string, operation: () => Promise<A>) {
	return Effect.tryPromise({
		catch: (cause) => new ReportFileFailure({ cause, path, reason: cause instanceof Error ? cause.message : "Filesystem operation failed" }),
		try: operation,
	});
}

export function withReportFile<A, E, R>(path: string, acquire: () => Promise<FileHandle>, use: (file: FileHandle) => Effect.Effect<A, E, R>) {
	return Effect.acquireUseRelease(reportFileIo(path, acquire), use, (file) => reportFileIo(path, () => file.close()));
}

export function hasFileCode(cause: unknown, code: string) {
	return cause instanceof Error && "code" in cause && cause.code === code;
}
