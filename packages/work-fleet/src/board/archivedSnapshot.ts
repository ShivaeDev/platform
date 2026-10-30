import { Effect } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { BoardSnapshot } from "#board/readPass.ts";
import { BoardFailure } from "#policy.ts";

export const archivedSnapshot = Effect.fn("FleetBoard.archivedSnapshot")(function* (root: string, current: BoardSnapshot, item: string) {
	const loaded = yield* board
		.loadSettled(
			root,
			{
				documents: current.documents,
				entries: [],
				model: current.model,
				modified: new Map(),
				revision: 0,
				unavailable: [],
			},
			item,
		)
		.pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })));
	return new BoardSnapshot(
		loaded.documents.map((document) => ({ ...document, source: (document.parsed.raw ?? "") + document.parsed.body })),
		current.problems,
	);
});
