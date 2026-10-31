import { Context, Effect, FileSystem, Layer, Path, Semaphore } from "effect";
import type { MetadataDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import type { Snapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import type { BoardDocument } from "#board/documents.ts";
import { BoardIndex } from "#board/Index.ts";
import { validateDocument } from "#board/readDocument.ts";
import { BoardSnapshot } from "#board/readPass.ts";
import { STATUS_MARKER } from "#board/statusMarkdown.ts";
import { warnSnapshotProblems } from "#board/warnSnapshotProblems.ts";
import { BoardFailure } from "#policy.ts";

export function watchedBoard(root: string) {
	return Layer.effect(BoardIndex)(
		Effect.gen(function* () {
			const owner = yield* Effect.context<never>();
			const watched = yield* board.watchIndex(root);
			// Transient request passes and clocks must not become part of the long-lived index.
			const index = {
				...watched,
				read: watched.read.pipe(Effect.updateContext<never, never>(() => owner)),
				reconcile: watched.reconcile.pipe(Effect.updateContext<never, never>(() => owner)),
			};
			const platform = (yield* Effect.context<FileSystem.FileSystem | Path.Path>()).pipe(Context.pick(FileSystem.FileSystem, Path.Path));
			const lock = yield* Semaphore.make(1);
			const checked = new WeakMap<MetadataDocument, Effect.Success<ReturnType<typeof validateDocument>>>();
			function observe(document: MetadataDocument) {
				return Effect.gen(function* () {
					const source = (document.parsed.raw ?? "") + document.parsed.body;
					if (document.file === "fleet/status.md" && source.startsWith(`${STATUS_MARKER}\n`)) {
						return undefined;
					}
					const known = checked.get(document);
					if (known !== undefined) {
						return known;
					}
					const result = yield* validateDocument(root, { ...document, source });
					checked.set(document, result);
					return result;
				});
			}
			function build(current: Snapshot) {
				return Effect.gen(function* () {
					const observed = yield* Effect.forEach(current.documents, observe, { concurrency: 16 });
					const problems = new Map<string, BoardFailure>(
						current.unavailable.map((file) => [
							file,
							new BoardFailure({ code: "incomplete-observation", message: `Board source is unavailable: ${file}` }),
						]),
					);
					const documents: BoardDocument[] = [];
					for (const result of observed) {
						if (result === undefined) {
							continue;
						}
						documents.push(result.document);
						if (result.problem !== undefined) {
							problems.set(result.document.file, result.problem);
						}
					}
					return new BoardSnapshot(documents, problems, current.model);
				});
			}

			let previous: Snapshot | undefined;
			let snapshot: BoardSnapshot;
			function readFailure(error: { readonly message: string }) {
				return new BoardFailure({ code: "incomplete-observation", message: `Board sources could not be read: ${root} (${error.message})` });
			}

			const read = lock
				.withPermit(
					Effect.gen(function* () {
						const current = yield* index.read.pipe(Effect.mapError(readFailure));
						if (current === previous) {
							return snapshot;
						}
						snapshot = yield* build(current);
						previous = current;
						yield* warnSnapshotProblems(index.changes.realRoot, snapshot);
						return snapshot;
					}),
				)
				.pipe(Effect.provideContext(platform));
			return {
				index,
				// Keep pass-local edits out of the cached indexed observation.
				snapshot: read.pipe(Effect.map((current) => new BoardSnapshot(current.documents, new Map(current.problems), current.model))),
			};
		}),
	);
}
