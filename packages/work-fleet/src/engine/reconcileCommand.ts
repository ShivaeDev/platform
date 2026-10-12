import { Effect } from "effect";
import { capacityRetry } from "#engine/capacityRetry.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeAdvance } from "#engine/makeAdvance.ts";
import type { EngineState } from "#engine/makeState.ts";
import { persistTerminalReceipts } from "#engine/persistTerminalReceipts.ts";
import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { transientFailure } from "#session/transientFailure.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";
import type { Versioned } from "#storage/model.ts";

function capacityFailure(error: unknown) {
	return (
		error instanceof StorageAdmission
		|| error instanceof StorageQuota
		|| error instanceof StorageCapacity
		|| failureCode(error) === "provider-quota-unavailable"
	);
}
export function reconcileCommand(state: EngineState, advance: ReturnType<typeof makeAdvance>) {
	const { load, save, decision } = state;
	const handleFailure = Effect.fn("Fleet.handleFailure")(function* (workId: string, error: unknown) {
		let current = yield* load(workId);
		if (error instanceof StorageConflict || ["completed", "released", "needs-human"].includes(current.value.stage)) {
			return current;
		}
		if (error instanceof SessionFailure && transientFailure(error)) {
			const attempt = current.value.attempts.at(-1);
			if (
				current.value.launchRetry !== undefined
				|| (attempt !== undefined && (yield* capacityRetry(state, current.value, attempt.operationId, error)))
			) {
				return yield* load(workId);
			}
		}
		if (capacityFailure(error)) {
			return yield* save(current, { ...current.value, attentionOwner: failureOwner(error), blocker: failureMessage(error) });
		}
		current = yield* persistTerminalReceipts(state, current, error instanceof SessionFailure ? error.terminalReceipts : undefined);
		return yield* decision(
			current,
			failureCode(error),
			failureMessage(error),
			"Inspect this specific integration failure and retry the existing work",
			undefined,
			failureContext(error).attentionOwner,
		).pipe(Effect.catchTag("BoardFailure", () => load(workId)));
	});
	return Effect.fn("Fleet.reconcile")(function* (
		workId: string,
	): Effect.fn.Return<Versioned<FleetRecord>, Effect.Error<ReturnType<typeof decision>> | Effect.Error<ReturnType<typeof load>>> {
		return yield* advance(workId).pipe(Effect.catch((error) => handleFailure(workId, error)));
	});
}
