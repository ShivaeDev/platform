import { Effect } from "effect";
import type { MetadataDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import type { Snapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { BoardFailure } from "#policy.ts";

export function metadataProblem(document: MetadataDocument) {
	const diagnostics = document.parsed.diagnostics.filter(
		(diagnostic) => !((diagnostic.field === "pr" || diagnostic.field === "branch") && diagnostic.message.startsWith("Unknown field ")),
	);
	return diagnostics.length === 0
		? undefined
		: new BoardFailure({
				message: `Board metadata is invalid: ${document.file} (${diagnostics.map((diagnostic) => `${diagnostic.field ?? "frontmatter"}: line ${diagnostic.line}: ${diagnostic.message}`).join("; ")})`,
			});
}

export function snapshotProblems(snapshot: Snapshot) {
	return new Map([
		...snapshot.unavailable.map(
			(file) => [file, new BoardFailure({ code: "incomplete-observation", message: `Board source is unavailable: ${file}` })] as const,
		),
		...snapshot.documents.flatMap((document) => {
			const problem = metadataProblem(document);
			return problem ? [[document.file, problem] as const] : [];
		}),
	]);
}

export const workDocument = Effect.fn("FleetBoard.workDocument")(function* (root: string, snapshot: Snapshot, workId: string) {
	if (snapshot.unavailable.length > 0) {
		return yield* Effect.fail(
			new BoardFailure({ code: "incomplete-observation", message: `Board sources are unavailable: ${snapshot.unavailable.join(", ")}` }),
		);
	}
	const matches = snapshot.model.ids.get(workId);
	const found = matches?.length === 1 ? matches[0] : undefined;
	if (found === undefined) {
		const problems = snapshotProblems(snapshot);
		return yield* Effect.fail(
			matches === undefined && problems.size === 0
				? new BoardFailure({ code: "board-item-missing", message: `Board item no longer exists: ${workId}`, workId })
				: new BoardFailure({
						message: `Board identity is missing or ambiguous: ${workId}; ${[...problems.values()].map((failure) => failure.message).join("; ")}`,
					}),
		);
	}
	const areas = yield* board
		.areaDiagnostics(root, found.parsed, found.file)
		.pipe(Effect.mapError((error) => new BoardFailure({ code: "incomplete-observation", message: error.message })));
	const problem = metadataProblem({ ...found, parsed: { ...found.parsed, diagnostics: [...found.parsed.diagnostics, ...areas] } });
	return yield* problem ? Effect.fail(problem) : Effect.succeed(found);
});
