import { Effect } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeAdvance } from "#engine/makeAdvance.ts";
import type { EngineState } from "#engine/makeState.ts";
import { persistTerminalReceipts } from "#engine/persistTerminalReceipts.ts";
import { readRetry } from "#engine/readRetry.ts";
import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
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
		const retrying = yield* readRetry(state, current, error);
		if (retrying !== undefined) {
			return retrying;
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
		const current = yield* load(workId);
		const retry = current.value.attempts.at(-1)?.readRetry;
		if (current.value.stage !== "needs-human" && retry !== undefined && state.policy.now() < retry.retryAt) {
			return current;
		}
		return yield* advance(workId).pipe(Effect.catch((error) => handleFailure(workId, error)));
	});
}
