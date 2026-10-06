import { Effect } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import type { makeAdvance } from "#engine/makeAdvance.ts";
import type { EngineState } from "#engine/makeState.ts";
import { FleetFailure } from "#policy.ts";
import { StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";
export function reconcileCommand({ load, save, decision }: EngineState, advance: ReturnType<typeof makeAdvance>) {
	return Effect.fn("Fleet.reconcile")(function* (workId: string) {
		return yield* advance(workId).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(workId);
					if (error instanceof StorageConflict || ["completed", "released", "needs-human"].includes(current.value.stage)) {
						return current;
					}
					if (
						error instanceof StorageQuota
						|| error instanceof StorageCapacity
						|| (error instanceof FleetFailure && error.reason === "denied" && error.message.includes("quota"))
					) {
						return yield* save(current, { ...current.value, blocker: failureMessage(error) });
					}
					return yield* decision(current, failureMessage(error), "Inspect this specific integration failure and retry the existing work");
				}),
			),
		);
	});
}
