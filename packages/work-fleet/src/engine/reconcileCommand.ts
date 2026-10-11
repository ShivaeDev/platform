import { Effect } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeAdvance } from "#engine/makeAdvance.ts";
import type { EngineState } from "#engine/makeState.ts";
import { persistTerminalReceipts } from "#engine/persistTerminalReceipts.ts";
import { FleetFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";

function capacityFailure(error: unknown) {
	return (
		error instanceof StorageAdmission
		|| error instanceof StorageQuota
		|| error instanceof StorageCapacity
		|| (error instanceof FleetFailure && error.reason === "denied" && error.message.includes("quota"))
	);
}
export function reconcileCommand(state: EngineState, advance: ReturnType<typeof makeAdvance>) {
	const { load, save, decision } = state;
	const handleFailure = Effect.fn("Fleet.handleFailure")(function* (workId: string, error: unknown) {
		let current = yield* load(workId);
		if (error instanceof StorageConflict || ["completed", "released", "needs-human"].includes(current.value.stage)) {
			return current;
		}
		if (capacityFailure(error)) {
			return yield* save(current, { ...current.value, attentionOwner: failureOwner(error), blocker: failureMessage(error) });
		}
		current = yield* persistTerminalReceipts(state, current, error instanceof SessionFailure ? error.terminalReceipts : undefined);
		return yield* decision(
			current,
			failureMessage(error),
			"Inspect this specific integration failure and retry the existing work",
			undefined,
			error instanceof FleetFailure ? error.attentionOwner : undefined,
		);
	});
	return Effect.fn("Fleet.reconcile")(function* (workId: string) {
		return yield* advance(workId).pipe(Effect.catch((error) => handleFailure(workId, error)));
	});
}
