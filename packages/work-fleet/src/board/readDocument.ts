import { Effect, FileSystem } from "effect";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import type { BoardDocument } from "#board/documents.ts";
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
	return yield* validateDocument(root, { file, parsed: boardApi.metadataParse(source), source });
});

export const validateDocument = Effect.fn("FleetBoard.validateDocument")(function* (root: string, document: BoardDocument) {
	const { file } = document;
	const parsed = document.parsed;
	const areas = yield* boardApi
		.areaDiagnostics(root, parsed, file)
		.pipe(
			Effect.mapError(
				(error) => new BoardFailure({ code: "incomplete-observation", message: `Board area folders could not be read: ${file} (${error.message})` }),
			),
		);
	const diagnostics = [...parsed.diagnostics, ...areas].filter(
		(diagnostic) => !((diagnostic.field === "pr" || diagnostic.field === "branch") && diagnostic.message.startsWith("Unknown field ")),
	);
	return {
		document,
		problem:
			diagnostics.length === 0
				? undefined
				: new BoardFailure({
						message: `Board metadata is invalid: ${file} (${diagnostics.map((diagnostic) => `${diagnostic.field ?? "frontmatter"}: line ${diagnostic.line}: ${diagnostic.message}`).join("; ")})`,
					}),
	};
});
