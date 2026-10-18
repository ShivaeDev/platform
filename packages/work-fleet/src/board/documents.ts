import { Effect, FileSystem, Path } from "effect";
import type { MetadataDocument } from "@shivaedev/work-board/server/integration/board.ts";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { readDocument } from "#board/readDocument.ts";
import { BoardSnapshot, readSnapshot } from "#board/readPass.ts";
import { BoardFailure } from "#policy.ts";

const { listMarkdown } = boardApi;

export type BoardDocument = MetadataDocument & { readonly source: string };

export const snapshotDocument = Effect.fn("FleetBoard.snapshotDocument")(function* (snapshot: BoardSnapshot, workId: string) {
	const matches = snapshot.model.ids.get(workId);
	const found = matches?.length === 1 ? snapshot.files.get(matches[0]?.file ?? "") : undefined;
	if (found === undefined) {
		const message = [
			`Board identity is missing or ambiguous: ${workId}`,
			...Array.from(snapshot.problems.values(), (failure) => failure.message),
		].join("; ");
		const incomplete = Array.from(snapshot.problems.values()).some((failure) => failure.code === "incomplete-observation");
		return yield* Effect.fail(new BoardFailure({ code: incomplete ? "incomplete-observation" : undefined, message }));
	}
	const problem = snapshot.problems.get(found.file);
	return yield* problem === undefined ? Effect.succeed(found) : Effect.fail(problem);
});

const readDocuments = Effect.fn("FleetBoard.readDocuments")(function* (root: string, realRoot: string) {
	const files = yield* listMarkdown(root, realRoot).pipe(
		Effect.mapError(
			(error) => new BoardFailure({ code: "incomplete-observation", message: `Board sources could not be listed: ${root} (${error.message})` }),
		),
	);
	const problems = new Map<string, BoardFailure>();
	const documents = yield* Effect.forEach(files, (file) =>
		readDocument(root, realRoot, file.path).pipe(
			Effect.map(({ document, problem }) => {
				if (problem !== undefined) {
					problems.set(file.path, problem);
				}
				return document;
			}),
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

export const refreshSnapshotDocument = Effect.fn("FleetBoard.refreshSnapshotDocument")(function* (
	root: string,
	realRoot: string,
	snapshot: BoardSnapshot,
	workId: string,
) {
	const previous = yield* snapshotDocument(snapshot, workId);
	const { document, problem } = yield* readDocument(root, realRoot, previous.file);
	if (problem !== undefined) {
		return yield* Effect.fail(problem);
	}
	if (document === undefined) {
		return yield* Effect.fail(new BoardFailure({ code: "incomplete-observation", message: `Board source is unavailable: ${previous.file}` }));
	}
	snapshot.record(document);
	return yield* snapshotDocument(snapshot, workId);
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
