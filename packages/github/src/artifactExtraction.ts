import { Effect, Stream } from "effect";
import { zipEntries } from "#adapters/zipEntries.ts";
import {
	GitHubArtifactCompressionRatio,
	GitHubArtifactExtractedTooLarge,
	GitHubArtifactExtractionError,
	GitHubArtifactSymlink,
} from "#artifactErrors.ts";
import { artifactPaths } from "#artifactPaths.ts";

export interface ArtifactExtractionOptions {
	readonly compressionRatioLimit?: number;
	readonly totalSizeLimit?: number;
}

export interface ArtifactFile {
	readonly bytes: Uint8Array;
	readonly path: string;
}

export const extractArtifactArchive = Effect.fn("GitHub.extractArtifactArchive")(function* (bytes: Uint8Array, options: ArtifactExtractionOptions) {
	const totalSizeLimit = options.totalSizeLimit ?? 100 * 1024 * 1024;
	const compressionRatioLimit = options.compressionRatioLimit ?? 100;
	if (!Number.isSafeInteger(totalSizeLimit) || totalSizeLimit < 0 || !Number.isFinite(compressionRatioLimit) || compressionRatioLimit <= 0) {
		return yield* new GitHubArtifactExtractionError({ reason: "invalid-limits" });
	}
	const entries = yield* zipEntries(bytes);
	const pathOf = artifactPaths();
	const files: ArtifactFile[] = [];
	let total = 0;
	yield* entries.pipe(
		Stream.runForEach((entry) =>
			Effect.gen(function* () {
				const path = yield* pathOf(entry.path, entry.directory);
				yield* validateEntry(entry, total, { compressionRatioLimit, totalSizeLimit });
				const content = yield* entry.read({ compressionRatioLimit, remaining: totalSizeLimit - total, totalSizeLimit });
				total += content.byteLength;
				if (!entry.directory) {
					files.push({ bytes: content, path });
				}
			}),
		),
	);
	return files;
});

type ZipEntry = Stream.Success<Effect.Success<ReturnType<typeof zipEntries>>>;

const validateEntry = Effect.fnUntraced(function* (entry: ZipEntry, total: number, options: Required<ArtifactExtractionOptions>) {
	if (entry.symlink) {
		return yield* new GitHubArtifactSymlink({ path: entry.path });
	}
	if (entry.directory && entry.uncompressedSize !== 0) {
		return yield* new GitHubArtifactExtractionError({ reason: "invalid-archive" });
	}
	if (total + entry.uncompressedSize > options.totalSizeLimit) {
		return yield* new GitHubArtifactExtractedTooLarge({ limit: options.totalSizeLimit });
	}
	if (entry.uncompressedSize > entry.compressedSize * options.compressionRatioLimit) {
		return yield* new GitHubArtifactCompressionRatio({ limit: options.compressionRatioLimit, path: entry.path });
	}
});
