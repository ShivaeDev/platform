import { Effect, FileSystem } from "effect";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { STATUS_MARKER } from "#board/statusMarkdown.ts";
import { BoardFailure } from "#policy.ts";

export const readDocument = Effect.fn("FleetBoard.readDocument")(function* (root: string, realRoot: string, file: string) {
	const fs = yield* FileSystem.FileSystem;
	const real = yield* boardApi.markdownPath(root, realRoot, file);
	if (!real) {
		return yield* Effect.fail(new BoardFailure({ code: "incomplete-observation", message: `Board source is unavailable: ${file}` }));
	}
	const source = yield* fs
		.readFileString(real)
		.pipe(
			Effect.mapError(
				(error) => new BoardFailure({ code: "incomplete-observation", message: `Board source could not be read: ${file} (${error.message})` }),
			),
		);
	if (file === "fleet/status.md" && source.startsWith(`${STATUS_MARKER}\n`)) {
		return { document: undefined, problem: undefined };
	}
	const parsed = boardApi.metadataParse(source);
	const diagnostics = parsed.diagnostics.filter(
		(diagnostic) => !((diagnostic.field === "pr" || diagnostic.field === "branch") && diagnostic.message.startsWith("Unknown field ")),
	);
	return {
		document: { file, parsed, source },
		problem:
			diagnostics.length === 0
				? undefined
				: new BoardFailure({
						message: `Board metadata is invalid: ${file} (${diagnostics.map((diagnostic) => `line ${diagnostic.line}: ${diagnostic.message}`).join("; ")})`,
					}),
	};
});
