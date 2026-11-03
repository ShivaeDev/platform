import { Effect } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { documentSource } from "@shivaedev/work-board/server/metadata/model.ts";
import type { Snapshot as BoardSnapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { metadataProblem, snapshotProblems } from "#board/workPolicy.ts";
import { BoardFailure } from "#policy.ts";

const previous = new Map<string, ReadonlyMap<string, string>>();

export const warnSnapshotProblems = Effect.fn("FleetBoard.warnSnapshotProblems")(function* (root: string, snapshot: BoardSnapshot) {
	const seen = previous.get(root);
	const next = new Map<string, string>();
	const problems = snapshotProblems(snapshot);
	for (const document of snapshot.documents) {
		const areas = yield* board
			.areaDiagnostics(root, document.parsed, document.file)
			.pipe(Effect.mapError((error) => new BoardFailure({ code: "incomplete-observation", message: error.message })));
		const problem = metadataProblem({ ...document, parsed: { ...document.parsed, diagnostics: [...document.parsed.diagnostics, ...areas] } });
		if (problem) {
			problems.set(document.file, problem);
		}
	}
	for (const [file, problem] of problems) {
		const document = snapshot.documents.find((entry) => entry.file === file);
		if (document === undefined) {
			yield* Effect.logWarning(problem.message);
			continue;
		}
		const fingerprint = responses.revisionOf(JSON.stringify([documentSource(document), problem.message]));
		next.set(file, fingerprint);
		if (seen?.get(file) !== fingerprint) {
			yield* Effect.logWarning(problem.message);
		}
	}
	if (next.size === 0) {
		previous.delete(root);
	} else {
		previous.set(root, next);
	}
});
