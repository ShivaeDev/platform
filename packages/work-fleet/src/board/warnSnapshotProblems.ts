import { Effect } from "effect";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardSnapshot } from "#board/readPass.ts";

const previous = new Map<string, ReadonlyMap<string, string>>();

export const warnSnapshotProblems = Effect.fn("FleetBoard.warnSnapshotProblems")(function* (root: string, snapshot: BoardSnapshot) {
	const seen = previous.get(root);
	const next = new Map<string, string>();
	for (const [file, problem] of snapshot.problems) {
		const document = snapshot.files.get(file);
		if (document === undefined) {
			yield* Effect.logWarning(problem.message);
			continue;
		}
		const fingerprint = responses.revisionOf(JSON.stringify([document.source, problem.message]));
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
