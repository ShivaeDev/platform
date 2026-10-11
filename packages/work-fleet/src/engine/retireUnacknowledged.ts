import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function retireUnacknowledged(state: EngineState, stored: Versioned<FleetRecord>) {
	const attempts = stored.value.attempts.map((attempt) =>
		attempt.status === "submitting"
		&& attempt.sessionId === undefined
		&& attempt.receipt === undefined
		&& (attempt.terminalReceipts?.length ?? 0) === 0
			? { ...attempt, status: "failed" as const }
			: attempt,
	);
	// The journal rejects acknowledgements after this CAS, before a turn can start.
	return attempts.some((attempt, index) => attempt !== stored.value.attempts[index])
		? state.save(stored, { ...stored.value, attempts })
		: Effect.succeed(stored);
}
