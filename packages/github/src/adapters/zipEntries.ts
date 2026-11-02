import type { Entry } from "@zip.js/zip.js";
import { Effect, Stream } from "effect";
import { GitHubArtifactCompressionRatio, GitHubArtifactExtractedTooLarge, GitHubArtifactExtractionError } from "#artifactErrors.ts";

interface ReadLimits {
	readonly compressionRatioLimit: number;
	readonly remaining: number;
	readonly totalSizeLimit: number;
}

function invalidArchive() {
	return new GitHubArtifactExtractionError({ reason: "invalid-archive" });
}

function readEntry(entry: Entry, limits: ReadLimits) {
	return Effect.tryPromise({
		catch: (error) =>
			error instanceof GitHubArtifactExtractedTooLarge || error instanceof GitHubArtifactCompressionRatio ? error : invalidArchive(),
		try: async (signal) => {
			let size = 0;
			const chunks: Uint8Array[] = [];
			const output = new WritableStream<Uint8Array>({
				write(chunk) {
					size += chunk.byteLength;
					if (size > limits.remaining) {
						throw new GitHubArtifactExtractedTooLarge({ limit: limits.totalSizeLimit });
					}
					if (size > entry.compressedSize * limits.compressionRatioLimit) {
						throw new GitHubArtifactCompressionRatio({ limit: limits.compressionRatioLimit, path: entry.filename });
					}
					chunks.push(chunk);
				},
			});
			if (!entry.directory) {
				await entry.getData(output, { signal });
			}
			const result = new Uint8Array(size);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return result;
		},
	});
}

export const zipEntries = Effect.fn("GitHub.zipEntries")(function* (bytes: Uint8Array) {
	const { ZipReader, Uint8ArrayReader } = yield* Effect.tryPromise({
		catch: () => new GitHubArtifactExtractionError({ reason: "reader-unavailable" }),
		try: () => import("@zip.js/zip.js"),
	});
	const reader = new ZipReader(new Uint8ArrayReader(bytes), {
		checkCrc32: true,
		// Core validates paths so refusals retain their dedicated typed error.
		filenameValidation: "tolerant",
		useWebWorkers: false,
	});
	return Stream.fromAsyncIterable(reader.getEntriesGenerator(), invalidArchive).pipe(
		Stream.map((entry) => ({
			compressedSize: entry.compressedSize,
			directory: entry.directory,
			path: entry.filename,
			read: (limits: ReadLimits) => readEntry(entry, limits),
			symlink: entry.symlink,
			uncompressedSize: entry.uncompressedSize,
		})),
	);
});
