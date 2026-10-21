import { Effect } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { restartableReview } from "#engine/restartableReview.ts";
import { retryPrompt } from "#engine/retryPrompt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { busyThread, transientFailure } from "#session/transientFailure.ts";

const retryStages: Readonly<Record<Attempt["role"], FleetRecord["step"]>> = { repair: "repairing", reviewer: "reviewing", worker: "queued" };

export const retryLostReview = Effect.fn("Fleet.retryLostReview")(function* (state: EngineState, record: FleetRecord, error: unknown) {
	const attempt = record.attempts.at(-1);
	return attempt !== undefined && restartableReview(record, error) ? yield* capacityRetry(state, record, attempt.operationId, error) : false;
});

export const retryMissingReview = Effect.fn("Fleet.retryMissingReview")(function* (state: EngineState, record: FleetRecord, error: unknown) {
	return error instanceof SessionFailure && error.code === "session-turn-missing" && (yield* retryLostReview(state, record, error))
		? yield* state.load(record.workId)
		: undefined;
});

export const capacityRetry = Effect.fn("Fleet.capacityRetry")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	error: SessionFailure,
) {
	const restartReview = restartableReview(previous, error);
	if (!(transientFailure(error) || restartReview)) {
		return false;
	}
	const current = yield* state.load(previous.workId);
	if (restartReview && (current.value.attempts.at(-1)?.operationId !== operationId || !restartableReview(current.value, error))) {
		return false;
	}
	const rejected = current.value.attempts.find((item) => item.operationId === operationId);
	if (rejected === undefined || (rejected.receipt !== undefined && rejected.status !== "failed")) {
		return false;
	}
	const rejectedAt = state.policy.now();
	const rejections = (previous.launchRetry?.rejections ?? rejected.providerFailures ?? 0) + 1;
	const delay = Math.min(300_000, 30_000 * 2 ** Math.min(rejections - 1, 4));
	const freshThread = busyThread(error);
	const saved = yield* state.save(current, {
		...current.value,
		attempts: current.value.attempts.map((attempt) =>
			attempt.operationId === operationId
				? {
						...attempt,
						output: error.message,
						readRetry: undefined,
						...(restartReview ? { sessionUnusable: true } : {}),
						...(freshThread ? { prompt: retryPrompt(previous, attempt), sessionUnusable: true } : {}),
						status: "failed" as const,
					}
				: attempt,
		),
		blocker: undefined,
		launchRetry: rejections < 5 ? { rejectedAt, rejections, retryAt: rejectedAt + delay } : undefined,
		step: previous.decision?.code === "worker-question" ? "repairing" : retryStages[rejected.role],
	});
	if (rejections >= 5) {
		yield* state.decision(
			saved,
			failureCode(error),
			`${error.message}; provider failure after ${rejections} attempts (${rejections - 1} automatic retries)`,
			"Inspect the provider failure and retry or safely release",
		);
	}
	return true;
});
