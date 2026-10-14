import { Effect } from "effect";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { obtainReview } from "#engine/obtainReview.ts";
import { retryPrompt } from "#engine/retryPrompt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

const STEER =
	"There has been no visible progress. Continue the approved work now, or stop with a FLEET_QUESTION explaining what you need to proceed.";

export const recoverStall = Effect.fn("Fleet.recoverStall")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt | undefined,
) {
	if (stored.value.stage === "needs-human" || attempt?.receipt === undefined) {
		return undefined;
	}
	const now = state.policy.now();
	const recovery = attempt.stallRecovery;
	if (attempt.status === "interrupted" && recovery?.interruptRequestedAt !== undefined) {
		return yield* resumeStalled(state, stored, attempt);
	}
	if (attempt.status !== "running" || attempt.progress === undefined) {
		return undefined;
	}
	const budget = (state.policy.stallMinutes ?? 30) * 60_000;
	if (now - Math.max(attempt.progress.at, recovery?.lastActionAt ?? attempt.submittedAt) < budget) {
		return recovery?.interruptRequestedAt === undefined ? undefined : stored;
	}
	const count = recovery?.count ?? 0;
	if (count >= 2) {
		return yield* state.decision(
			stored,
			"session-stalled",
			"Provider turn stalled after automatic steer and interrupt recovery",
			"Inspect the worker thread and retry or safely release",
		);
	}
	if (count === 0) {
		const saved = yield* saveRecovery(state, stored, attempt, { ...recovery, count: 1, lastActionAt: now, steeredAt: now });
		yield* state.sessions.steer(attempt.receipt, STEER);
		return saved;
	}
	const requested = yield* saveRecovery(state, stored, attempt, { ...recovery, count: 2, interruptRequestedAt: now, lastActionAt: now });
	yield* state.sessions.interrupt(attempt.receipt);
	const interrupted = yield* saveRecovery(state, requested, attempt, {
		...requested.value.attempts.at(-1)?.stallRecovery,
		count: 2,
		interruptedAt: now,
		lastActionAt: now,
	});
	const observation = yield* state.sessions.observe(attempt.receipt);
	if (observation.execution !== "interrupted") {
		return interrupted;
	}
	const terminal = yield* state.save(interrupted, {
		...interrupted.value,
		attempts: interrupted.value.attempts.map((entry) =>
			entry.operationId === attempt.operationId ? { ...entry, output: observation.output, status: observation.execution } : entry,
		),
	});
	return yield* resumeStalled(state, terminal, attempt);
});

function saveRecovery(state: EngineState, stored: Versioned<FleetRecord>, attempt: Attempt, stallRecovery: NonNullable<Attempt["stallRecovery"]>) {
	return state.save(stored, {
		...stored.value,
		attempts: stored.value.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, stallRecovery } : entry)),
	});
}

const resumeStalled = Effect.fn("Fleet.resumeStalled")(function* (state: EngineState, stored: Versioned<FleetRecord>, attempt: Attempt) {
	const sessionId = attempt.receipt?.sessionId;
	if (sessionId === undefined) {
		return stored;
	}
	const stallRecovery = { count: 2, lastActionAt: state.policy.now() };
	const prompt = retryPrompt(stored.value, attempt);
	if (attempt.role === "reviewer") {
		const work = yield* state.board.get(stored.value.workId);
		if (stored.value.result === undefined) {
			return stored;
		}
		yield* obtainReview(state)(stored, work, stored.value.result, { prompt: attempt.prompt ?? prompt, sessionId, stallRecovery });
		return yield* state.load(stored.value.workId);
	}
	return yield* makeLaunch(state)(stored, attempt.role, prompt, { responses: stored.value.responses ?? [], sessionId, stallRecovery });
});
