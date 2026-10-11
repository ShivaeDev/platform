import { Effect } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeAdvance } from "#engine/makeAdvance.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";
import type { Versioned } from "#storage/model.ts";
export function reconcileCommand({ load, save, decision }: EngineState, advance: ReturnType<typeof makeAdvance>) {
	return Effect.fn("Fleet.reconcile")(function* (
		workId: string,
	): Effect.fn.Return<Versioned<FleetRecord>, Effect.Error<ReturnType<typeof decision>> | Effect.Error<ReturnType<typeof load>>> {
		return yield* advance(workId).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(workId);
					if (error instanceof StorageConflict || ["completed", "released", "needs-human"].includes(current.value.stage)) {
						return current;
					}
					if (
						error instanceof StorageAdmission
						|| error instanceof StorageQuota
						|| error instanceof StorageCapacity
						|| (error instanceof FleetFailure && error.reason === "denied" && error.message.includes("quota"))
					) {
						return yield* save(current, { ...current.value, attentionOwner: failureOwner(error), blocker: failureMessage(error) });
					}
					return yield* decision(
						current,
						failureMessage(error),
						"Inspect this specific integration failure and retry the existing work",
						undefined,
						error instanceof FleetFailure ? error.attentionOwner : undefined,
					).pipe(Effect.catchTag("BoardFailure", () => load(workId)));
				}),
			),
		);
	});
}
