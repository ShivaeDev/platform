import { Effect, Schema } from "effect";
import type { CodexActivity } from "#providers/codexLive.ts";
import { type codexTurns, finalOutput, type Progress } from "#providers/codexTurns.ts";
import { ProviderCapacity, type SessionObservation, type SessionReceipt } from "#session/schema.ts";

function sorted(progress: readonly Progress[]) {
	return [...progress].sort((left, right) => left.id.localeCompare(right.id));
}

function followActivity(activity: CodexActivity | undefined, sessionId: string) {
	return (activity?.follow(sessionId) ?? Effect.void).pipe(Effect.ignore);
}

export function observeCodexTurn(turns: ReturnType<typeof codexTurns>, provisioning: SessionObservation["provisioning"], activity?: CodexActivity) {
	const terminal = new Map<string, SessionObservation>();
	return Effect.fn("Codex.observe")(function* (receipt: SessionReceipt) {
		const key = `${receipt.sessionId}/${receipt.turnId}`;
		const cached = terminal.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const { turn, progress } = yield* turns.readTurn(receipt.sessionId, receipt.turnId);
		if (turn === undefined) {
			yield* followActivity(activity, receipt.sessionId);
			return {
				activityAt: activity?.at(receipt.sessionId),
				execution: "accepted" as const,
				output: "",
				progress: sorted(progress),
				provisioning,
				receipt,
				turnMissing: true,
			};
		}
		if (turn.status === "inProgress") {
			// The latest item still observes the turn when the provider refuses a subscription.
			yield* followActivity(activity, receipt.sessionId);
			const latest = yield* turns.latestItem(receipt.sessionId, receipt.turnId);
			return {
				activityAt: activity?.at(receipt.sessionId),
				execution: "running" as const,
				output: "",
				progress: latest === undefined ? [] : [{ id: latest.id, status: latest.status }],
				provisioning,
				receipt,
				subscribedAt: activity?.subscribedAt(receipt.sessionId),
			};
		}
		const items = yield* turns.readItems(receipt);
		const latest = items.at(-1);
		const capacity = Schema.decodeUnknownOption(ProviderCapacity)(turn.error?.codexErrorInfo);
		const observation: SessionObservation = {
			capacity: capacity._tag === "Some" && turn.status === "failed" ? capacity.value : undefined,
			error: turn.error?.message,
			execution: turn.status,
			output: finalOutput(items),
			progress: latest === undefined ? [] : [{ id: latest.id, status: latest.status }],
			provisioning,
			receipt,
		};
		terminal.set(key, observation);
		activity?.forget(receipt.sessionId);
		return observation;
	});
}
