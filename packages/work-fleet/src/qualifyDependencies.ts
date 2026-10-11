import { Effect } from "effect";
import { workRevision } from "#board/workRevision.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardFailure, type BoardWork, FleetFailure } from "#policy.ts";

export const qualifyDependencies = Effect.fn("Fleet.qualifyDependencies")(function* (
	references: readonly string[],
	records: readonly FleetRecord[],
	get: (workId: string) => Effect.Effect<BoardWork, BoardFailure>,
) {
	yield* Effect.forEach(references, (reference) =>
		Effect.gen(function* () {
			const [workId, criterion] = reference.split("#");
			if (!workId) {
				return yield* Effect.fail(new FleetFailure({ message: `Dependency reference is invalid: ${reference}`, reason: "denied" }));
			}
			const current = yield* get(workId).pipe(
				Effect.mapError(
					(error) =>
						new FleetFailure({
							message: `Dependency ${reference} is unavailable or ambiguous: ${error.message}`,
							reason: "denied",
						}),
				),
			);
			if (current.workId !== workId) {
				return yield* Effect.fail(new FleetFailure({ message: `Dependency identity is ambiguous: ${reference}`, reason: "denied" }));
			}
			if (criterion !== undefined) {
				return yield* Effect.fail(
					new FleetFailure({
						message: `Dependency ${reference} needs criterion-specific accepted evidence; a whole-work outcome cannot satisfy it`,
						reason: "denied",
					}),
				);
			}
			const hasFleetWork = records.some((record) => record.workId === workId);
			const accepted = dependencyAccepted(workId, current, records);
			const fallback = hasFleetWork ? "" : " or Board status done without Fleet work";
			if (!accepted) {
				return yield* Effect.fail(
					new FleetFailure({
						message: `waiting for dependency ${reference}: needs an accepted outcome for current Board revision ${current.revision}${fallback}`,
						reason: "denied",
					}),
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
