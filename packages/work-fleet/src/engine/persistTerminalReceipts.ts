import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function persistTerminalReceipts(state: EngineState, stored: Versioned<FleetRecord>, receipts: readonly SessionReceipt[] | undefined) {
	if (receipts === undefined) {
		return Effect.succeed(stored);
	}
	const operationId = stored.value.attempts.at(-1)?.operationId;
	return state.save(stored, {
		...stored.value,
		attempts: stored.value.attempts.map((attempt) => (attempt.operationId === operationId ? { ...attempt, terminalReceipts: receipts } : attempt)),
	});
}
