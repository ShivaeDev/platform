import { Effect, FileSystem, Path } from "effect";
import { listMarkdown } from "@shivaedev/work-board/files/list.ts";
import { markdownPath } from "@shivaedev/work-board/files/markdownPath.ts";
import type { MetadataDocument } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { BoardFailure } from "#policy.ts";

export type BoardDocument = MetadataDocument & { readonly source: string };

export const boardDocuments = Effect.fn("FleetBoard.boardDocuments")(function* (root: string, realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const files = yield* listMarkdown(root, realRoot);
	return yield* Effect.forEach(files, (file) =>
		Effect.gen(function* () {
			const real = yield* markdownPath(root, realRoot, file.path);
			if (!real) {
				return yield* Effect.fail(new BoardFailure({ message: `Board source is unavailable: ${file.path}` }));
			}
			const source = yield* fs.readFileString(real);
			const parsed = metadataParse(source);
			if (parsed.diagnostics.length > 0) {
				return yield* Effect.fail(new BoardFailure({ message: `Board metadata is invalid: ${file.path}` }));
			}
			return { file: file.path, parsed, source };
		}),
	);
});

export function boundDocuments(root: string, realRoot: string, fs: FileSystem.FileSystem, path: Path.Path) {
	return boardDocuments(root, realRoot).pipe(
		Effect.mapError(() => new BoardFailure({ message: "Board sources could not be read completely." })),
		Effect.provideService(FileSystem.FileSystem, fs),
		Effect.provideService(Path.Path, path),
	);
}
