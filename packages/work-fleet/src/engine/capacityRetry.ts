import { Effect } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { retryPrompt } from "#engine/retryPrompt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { SessionFailure } from "#session/schema.ts";
import { busyThread, transientFailure } from "#session/transientFailure.ts";

const retryStages: Readonly<Record<Attempt["role"], FleetRecord["stage"]>> = { repair: "repairing", reviewer: "reviewing", worker: "prepared" };

export const capacityRetry = Effect.fn("Fleet.capacityRetry")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	error: SessionFailure,
) {
	if (!transientFailure(error)) {
		return false;
	}
	const current = yield* state.load(previous.workId);
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
						...(freshThread ? { prompt: retryPrompt(previous, attempt), sessionUnusable: true } : {}),
						status: "failed" as const,
					}
				: attempt,
		),
		blocker: undefined,
		launchRetry: rejections < 5 ? { rejectedAt, rejections, retryAt: rejectedAt + delay } : undefined,
		stage: previous.decision?.code === "worker-question" ? "repairing" : retryStages[rejected.role],
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
