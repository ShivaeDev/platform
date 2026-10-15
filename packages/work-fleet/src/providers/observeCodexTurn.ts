import { Effect, Schema } from "effect";
import type { codexTurns } from "#providers/codexTurns.ts";
import { ProviderCapacity, type SessionObservation, type SessionReceipt } from "#session/schema.ts";

export function observeCodexTurn(turns: ReturnType<typeof codexTurns>, provisioning: SessionObservation["provisioning"]) {
	const terminal = new Map<string, SessionObservation>();
	return Effect.fn("Codex.observe")(function* (receipt: SessionReceipt) {
		const key = `${receipt.sessionId}/${receipt.turnId}`;
		const cached = terminal.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const { turn, progress } = yield* turns.readTurn(receipt.sessionId, receipt.turnId, true);
		if (turn === undefined) {
			return {
				execution: "accepted" as const,
				output: "",
				progress: progress.sort((left, right) => left.id.localeCompare(right.id)),
				provisioning,
				receipt,
				turnMissing: true,
			};
		}
		const output = turn.status === "inProgress" ? "" : yield* turns.readOutput(receipt);
		const capacity = Schema.decodeUnknownOption(ProviderCapacity)(turn.error?.codexErrorInfo);
		const observation: SessionObservation = {
			capacity: capacity._tag === "Some" && turn.status === "failed" ? capacity.value : undefined,
			error: turn.error?.message,
			execution: turn.status === "inProgress" ? "running" : turn.status,
			output,
			progress: turn.items.map(({ id, status }) => ({ id, status })).sort((left, right) => left.id.localeCompare(right.id)),
			provisioning,
			receipt,
		};
		if (observation.execution !== "running") {
			terminal.set(key, observation);
		}
		return observation;
	});
}
