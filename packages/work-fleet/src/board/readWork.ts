import { Effect, Path, Schema } from "effect";
import { documentSource } from "@shivaedev/work-board/server/metadata/model.ts";
import type { Snapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { fleetApproved, fleetDeliverable, fleetPriority } from "#board/fleetField.ts";
import { recordBoardWrite } from "#board/readPass.ts";
import { warnSnapshotProblems } from "#board/warnSnapshotProblems.ts";
import { metadataProblem, workDocument } from "#board/workPolicy.ts";
import { BoardFailure, Priority } from "#policy.ts";

export const readWork = Effect.fn("FleetBoard.readWork")(function* (current: Snapshot, workId: string, options?: { readonly fresh?: boolean }) {
	const workspace = yield* Workspace;
	const path = yield* Path.Path;
	const { root, realRoot } = yield* workspace.settings();
	let observed = current;
	if (!current.model.ids.has(workId)) {
		const { changes } = yield* workspace.settings();
		yield* changes.refresh ?? Effect.void;
		observed = yield* workspace
			.index()
			.pipe(Effect.mapError((error) => new BoardFailure({ code: "incomplete-observation", message: error.message })));
		yield* warnSnapshotProblems(realRoot, observed);
	}
	let found = yield* workDocument(root, observed, workId);
	if (options?.fresh) {
		const fresh = yield* workspace
			.metadata(found.file)
			.pipe(
				Effect.mapError(
					(error) =>
						new BoardFailure({ code: "incomplete-observation", message: `Board source could not be read: ${found.file} (${error.message})` }),
				),
			);
		const problem = metadataProblem(fresh);
		if (problem) {
			return yield* Effect.fail(problem);
		}
		if (fresh.parsed.fields.id !== workId) {
			return yield* Effect.fail(new BoardFailure({ code: "board-item-missing", message: `Board item no longer exists: ${workId}`, workId }));
		}
		found = fresh;
		yield* recordBoardWrite(realRoot, fresh.file);
	}
	const deliverable = fleetDeliverable(found.parsed);
	if (deliverable !== undefined && deliverable !== "report") {
		return yield* Effect.fail(new BoardFailure({ message: "Invalid delivers; use report or omit the field for pull requests." }));
	}
	const priority = fleetPriority(found.parsed);
	if (priority !== undefined && !Schema.is(Priority)(priority)) {
		return yield* Effect.fail(new BoardFailure({ message: "Invalid fleet-priority; use urgent, high, normal or low, or omit the field." }));
	}
	return {
		approved: fleetApproved(found.parsed),
		areas: found.parsed.fields.areas,
		status: found.parsed.fields.status,
		sweep: found.parsed.fields.sweep,
		...(deliverable === "report" ? { deliverable: "report" as const } : {}),
		context: documentSource(found),
		dependsOn: (found.parsed.fields.relationships ?? []).filter((relation) => relation.kind === "depends_on").map((relation) => relation.target),
		...(priority === undefined ? {} : { priority }),
		revision: briefRevision(found.parsed),
		sourcePath: path.join(realRoot, found.file),
		workId,
	};
});
