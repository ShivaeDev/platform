import { Effect, FileSystem, Path } from "effect";
import { listMarkdown } from "@shivaedev/work-board/files/list.ts";
import { markdownPath } from "@shivaedev/work-board/files/markdownPath.ts";
import type { MetadataDocument } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { boardDiagnostics } from "#board/fleetField.ts";
import { BoardSnapshot, readSnapshot } from "#board/readPass.ts";
import { BoardFailure } from "#policy.ts";

export type BoardDocument = MetadataDocument & { readonly source: string };

const readDocuments = Effect.fn("FleetBoard.readDocuments")(function* (root: string, realRoot: string) {
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
			if (boardDiagnostics(parsed).length > 0) {
				return yield* Effect.fail(new BoardFailure({ message: `Board metadata is invalid: ${file.path}` }));
			}
			return { file: file.path, parsed, source };
		}),
	);
});

export function boardSnapshot(root: string, realRoot: string) {
	return readSnapshot(
		realRoot,
		readDocuments(root, realRoot).pipe(
			Effect.map((documents) => new BoardSnapshot(documents)),
			Effect.mapError(() => new BoardFailure({ message: "Board sources could not be read completely." })),
		),
	);
}

export function boardDocuments(root: string, realRoot: string) {
	return boardSnapshot(root, realRoot).pipe(Effect.map((snapshot) => snapshot.documents));
}

export function boundSnapshot(root: string, realRoot: string, fs: FileSystem.FileSystem, path: Path.Path) {
	return boardSnapshot(root, realRoot).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
}

export function boundDocuments(root: string, realRoot: string, fs: FileSystem.FileSystem, path: Path.Path) {
	return boundSnapshot(root, realRoot, fs, path).pipe(Effect.map((snapshot) => snapshot.documents));
}
