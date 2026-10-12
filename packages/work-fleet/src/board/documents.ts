import { Effect, FileSystem, Path } from "effect";
import type { MetadataDocument } from "@shivaedev/work-board/integration/board.ts";
import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import { boardDiagnostics } from "#board/fleetField.ts";
import { BoardSnapshot, readSnapshot } from "#board/readPass.ts";
import { STATUS_MARKER } from "#board/statusMarkdown.ts";
import { BoardFailure } from "#policy.ts";

const { listMarkdown, markdownPath } = boardApi;

export type BoardDocument = MetadataDocument & { readonly source: string };

export const snapshotDocument = Effect.fn("FleetBoard.snapshotDocument")(function* (snapshot: BoardSnapshot, workId: string) {
	const matches = snapshot.model.ids.get(workId);
	const found = matches?.length === 1 ? snapshot.files.get(matches[0]?.file ?? "") : undefined;
	if (found === undefined) {
		const message = [
			`Board identity is missing or ambiguous: ${workId}`,
			...Array.from(snapshot.problems.values(), (failure) => failure.message),
		].join("; ");
		return yield* Effect.fail(new BoardFailure({ message }));
	}
	const problem = snapshot.problems.get(found.file);
	return yield* problem === undefined ? Effect.succeed(found) : Effect.fail(problem);
});

const readDocuments = Effect.fn("FleetBoard.readDocuments")(function* (root: string, realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const files = yield* listMarkdown(root, realRoot).pipe(
		Effect.mapError((error) => new BoardFailure({ message: `Board sources could not be listed: ${root} (${error.message})` })),
	);
	const problems = new Map<string, BoardFailure>();
	const read = Effect.fnUntraced(function* (file: string) {
		const real = yield* markdownPath(root, realRoot, file);
		if (!real) {
			return yield* Effect.fail(new BoardFailure({ message: `Board source is unavailable: ${file}` }));
		}
		const source = yield* fs
			.readFileString(real)
			.pipe(Effect.mapError((error) => new BoardFailure({ message: `Board source could not be read: ${file} (${error.message})` })));
		if (file === "fleet/status.md" && source.startsWith(`${STATUS_MARKER}\n`)) {
			return undefined;
		}
		const parsed = boardApi.metadataParse(source);
		const diagnostics = boardDiagnostics(parsed);
		if (diagnostics.length > 0) {
			problems.set(
				file,
				new BoardFailure({
					message: `Board metadata is invalid: ${file} (${diagnostics.map((diagnostic) => `line ${diagnostic.line}: ${diagnostic.message}`).join("; ")})`,
				}),
			);
		}
		return { file, parsed, source };
	});
	const documents = yield* Effect.forEach(files, (file) =>
		read(file.path).pipe(
			Effect.catch((error) => {
				problems.set(file.path, error);
				return Effect.succeed(undefined);
			}),
		),
	);
	for (const problem of problems.values()) {
		yield* Effect.logWarning(problem.message);
	}
	return new BoardSnapshot(
		documents.filter((document) => document !== undefined),
		problems,
	);
});

export function boardSnapshot(root: string, realRoot: string) {
	return readSnapshot(realRoot, readDocuments(root, realRoot));
}

export function boardDocuments(root: string, realRoot: string) {
	return boardSnapshot(root, realRoot).pipe(Effect.map((snapshot) => snapshot.documents.filter((document) => !snapshot.problems.has(document.file))));
}

export function boundSnapshot(root: string, realRoot: string, fs: FileSystem.FileSystem, path: Path.Path) {
	return boardSnapshot(root, realRoot).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
}

export function boundDocuments(root: string, realRoot: string, fs: FileSystem.FileSystem, path: Path.Path) {
	return boardDocuments(root, realRoot).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
}
