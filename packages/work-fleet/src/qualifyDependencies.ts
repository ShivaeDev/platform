import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { workRevision } from "#board/workRevision.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardFailure, BoardWork } from "#policy.ts";

export const qualifyDependencies = Effect.fn("Fleet.qualifyDependencies")(function* (
	references: readonly string[],
	records: readonly FleetRecord[],
	get: (workId: string) => Effect.Effect<BoardWork, BoardFailure>,
) {
	yield* Effect.forEach(references, (reference) =>
		Effect.gen(function* () {
			const [workId, criterion] = reference.split("#");
			if (!workId) {
				return yield* Effect.fail(new Forbidden({ message: `Dependency reference is invalid: ${reference}` }));
			}
			const current = yield* get(workId).pipe(
				Effect.mapError((error) => new Forbidden({ message: `Dependency ${reference} is unavailable or ambiguous: ${error.message}` })),
			);
			if (current.workId !== workId) {
				return yield* Effect.fail(new Forbidden({ message: `Dependency identity is ambiguous: ${reference}` }));
			}
			if (criterion !== undefined) {
				return yield* Effect.fail(
					new Forbidden({ message: `Dependency ${reference} needs criterion-specific accepted evidence; a whole-work outcome cannot satisfy it` }),
				);
			}
			const hasFleetWork = records.some((record) => record.workId === workId);
			const accepted = dependencyAccepted(workId, current, records);
			const fallback = hasFleetWork ? "" : " or Board status done without Fleet work";
			if (!accepted) {
				return yield* Effect.fail(
					withFailureContext(
						new Forbidden({
							message: `waiting for dependency ${reference}: needs an accepted outcome for current Board revision ${current.revision}${fallback}`,
						}),
						{ attentionOwner: "automation" },
					),
				);
			}
		}),
	);
});

function dependencyAccepted(workId: string, current: BoardWork, records: readonly FleetRecord[]): boolean {
	const record = records.find((entry) => entry.workId === workId);
	return record === undefined
		? current.status === "done"
		: record.stage === "completed"
				&& record.outcome !== undefined
				&& workRevision(record.boardRevision, record.boardContext) === workRevision(current.revision, current.context);
}
