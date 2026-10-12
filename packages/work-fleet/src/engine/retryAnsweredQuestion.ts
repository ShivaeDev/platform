import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { SessionFailure } from "#session/schema.ts";

export const retryAnsweredQuestion = Effect.fn("Fleet.retryAnsweredQuestion")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	error: SessionFailure,
) {
	if (previous.decision?.code !== "worker-question" || error.reason !== "rejected" || error.code !== "session-active-turn-exhausted") {
		return false;
	}
	const current = yield* state.load(previous.workId);
	const attempt = current.value.attempts.at(-1);
	if (attempt?.operationId !== operationId || attempt.receipt !== undefined || attempt.sessionId !== previous.decision.worker?.sessionId) {
		return false;
	}
	yield* state.save(current, {
		...current.value,
		attempts: current.value.attempts.map((item) =>
			item.operationId === operationId ? { ...item, sessionUnusable: true, status: "failed" as const } : item,
		),
		prompt: [
			previous.prompt,
			"Worker question:",
			previous.decision.reason,
			"Recorded answer:",
			attempt.prompt,
			`Continue on the same branch and PR${previous.result?.kind === "change" ? ` (${previous.result.pr})` : " created by the previous worker"}. Reuse that branch; do not create another branch or PR.`,
		].join("\n\n"),
		stage: "repairing",
	});
	return true;
});
