import { Effect } from "effect";
import { abandonStalled } from "#engine/abandonStalled.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { isAnswerTurn } from "#engine/isAnswerTurn.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { recoverMissingTurn } from "#engine/recoverMissingTurn.ts";
import { resumeAttempt } from "#engine/resumeAttempt.ts";
import { retryPrompt } from "#engine/retryPrompt.ts";
import { VISIBILITY_GRACE_MS } from "#engine/visibility.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const recoverUnobservable = Effect.fn("Fleet.recoverUnobservable")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt | undefined,
	threadIdle?: boolean,
) {
	if (attempt?.missingSince === undefined) {
		return undefined;
	}
	if (isAnswerTurn(stored.value, attempt)) {
		const marked = attempt.answerTurn
			? stored
			: yield* state.save(stored, {
					...stored.value,
					attempts: stored.value.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, answerTurn: true } : entry)),
				});
		return yield* recoverAnswerTurn(state, marked, { ...attempt, answerTurn: true });
	}
	if (stored.value.step !== "waiting" && state.integrations.publication !== undefined && attempt.role !== "reviewer" && threadIdle === false) {
		return yield* recoverMissingTurn(state, stored, undefined, threadIdle);
	}
	if (stored.value.step === "waiting" || state.policy.now() - Math.max(attempt.missingSince, attempt.progress?.at ?? 0) < VISIBILITY_GRACE_MS) {
		return stored;
	}
	if (state.integrations.publication !== undefined && attempt.role !== "reviewer") {
		return yield* recoverMissingTurn(state, stored, undefined, threadIdle);
	}
	if ((attempt.observationRetries ?? 0) >= 1) {
		return yield* state.decision(
			stored,
			"session-turn-missing",
			"The acknowledged Codex turn is not observable after the grace period and one automatic resume",
			"Inspect the worker thread and retry or safely release",
		);
	}
	yield* authorizeBriefContext(stored.value, yield* state.board.get(stored.value.workId));
	// Retire the missing receipt and reserve its replacement in the same compare-and-set.
	const retired = {
		...stored,
		value: {
			...stored.value,
			attempts: stored.value.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, status: "failed" as const } : entry)),
		},
	};
	return yield* resumeAttempt(state, retired, attempt, { observationRetries: 1 });
});

const recoverAnswerTurn = Effect.fn("Fleet.recoverAnswerTurn")(function* (state: EngineState, stored: Versioned<FleetRecord>, attempt: Attempt) {
	if (attempt.missingSince === undefined || state.policy.now() - Math.max(attempt.missingSince, attempt.progress?.at ?? 0) < VISIBILITY_GRACE_MS) {
		return stored;
	}
	if (stored.value.step === "waiting" && stored.value.decision?.code !== "session-turn-missing") {
		return stored;
	}
	yield* authorizeBriefContext(stored.value, yield* state.board.get(stored.value.workId, { fresh: true }));
	const abandoned = yield* abandonStalled(state, stored);
	if ((attempt.observationRetries ?? 0) >= 1) {
		return yield* state.decision(
			abandoned,
			"session-turn-missing",
			"Accepted answer turn remained unobservable with no thread progress for five minutes after one automatic restart; abandoned execution and released areas",
			"Inspect the worker thread and published work before retrying",
		);
	}
	return yield* makeLaunch(state)(abandoned, attempt.role === "repair" ? "repair" : "worker", retryPrompt(stored.value, attempt), {
		answerTurn: true,
		observationRetries: 1,
		responses: stored.value.responses ?? [],
	});
});
