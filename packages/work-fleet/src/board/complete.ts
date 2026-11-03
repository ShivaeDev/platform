import { Effect, Path } from "effect";
import { metadataParse } from "@shivaedev/work-board/metadata/adapters/parse.ts";
import { patchMetadata } from "@shivaedev/work-board/server/metadata/adapters/frontmatter.ts";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { recordBoardWrite } from "#board/readPass.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";

export const completeBoard = Effect.fn("FleetBoard.completeBoard")(function* (realRoot: string, work: BoardWork, nextAction: string) {
	const workspace = yield* Workspace;
	const path = yield* Path.Path;
	const fields = { "next_action": nextAction, status: "done" };
	const preview = yield* patchMetadata(work.context, fields).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })));
	if (preview === work.context) {
		return;
	}
	if (briefRevision(metadataParse(preview)) !== work.revision) {
		return yield* Effect.fail(new BoardFailure({ message: "Completion bookkeeping would change authored Board context or identity." }));
	}
	const updated = yield* workspace.writeMetadata({ fields, file: path.relative(realRoot, work.sourcePath), source: work.context }).pipe(
		Effect.catchTag("PreconditionFailed", () => Effect.succeed(undefined)),
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
	if (updated) {
		yield* recordBoardWrite(realRoot, updated.file);
	}
});
