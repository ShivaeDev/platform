import { Effect, Layer } from "effect";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { workspaceLayer } from "@shivaedev/work-board/server/workspaceLayer.ts";
import { BoardIndex } from "#board/Index.ts";
import { readSnapshot } from "#board/readPass.ts";
import { metadataProblem } from "#board/workPolicy.ts";
import { BoardFailure } from "#policy.ts";

export function headlessBoard(root: string) {
	return Layer.effect(BoardIndex)(
		Effect.gen(function* () {
			const workspace = yield* Workspace;
			const { changes } = yield* workspace.settings();
			const read = workspace.index();
			return { index: { changes, read, reconcile: Effect.andThen(changes.refresh ?? Effect.void, read).pipe(Effect.asVoid) } };
		}),
	).pipe(Layer.provideMerge(workspaceLayer({ root, writable: true })));
}

export function boardSnapshot(root: string, realRoot: string) {
	return readSnapshot(
		realRoot,
		Effect.gen(function* () {
			const workspace = yield* Effect.serviceOption(Workspace);
			const read =
				workspace._tag === "Some"
					? workspace.value.index()
					: Effect.scoped(Workspace.use((board) => board.index()).pipe(Effect.provide(workspaceLayer({ root }))));
			const snapshot = yield* read.pipe(
				Effect.mapError(
					(error) => new BoardFailure({ code: "incomplete-observation", message: `Board sources could not be read: ${root} (${error.message})` }),
				),
			);
			if (snapshot.unavailable.length > 0) {
				return yield* Effect.fail(
					new BoardFailure({ code: "incomplete-observation", message: `Board sources are unavailable: ${snapshot.unavailable.join(", ")}` }),
				);
			}
			return snapshot;
		}),
	);
}

export function boardDocuments(root: string, realRoot: string) {
	return boardSnapshot(root, realRoot).pipe(
		Effect.map((snapshot) => snapshot.documents.filter((document) => metadataProblem(document) === undefined)),
	);
}
