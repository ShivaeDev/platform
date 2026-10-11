import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { SessionFailure } from "#session/schema.ts";

export const capacityRetry = Effect.fn("Fleet.capacityRetry")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	error: SessionFailure,
) {
	if (error.reason !== "rejected" || /\brequest queue is full\b/iu.exec(error.message) === null) {
		return false;
	}
	const current = yield* state.load(previous.workId);
	const rejectedAt = state.policy.now();
	const rejections = (previous.launchRetry?.rejections ?? 0) + 1;
	const delay = Math.min(300_000, 30_000 * 2 ** Math.min(rejections - 1, 4));
	yield* state.save(current, {
		...current.value,
		attempts: current.value.attempts.map((attempt) =>
			attempt.operationId === operationId ? { ...attempt, output: error.message, status: "failed" as const } : attempt,
		),
		blocker: undefined,
		launchRetry: { rejectedAt, rejections, retryAt: rejectedAt + delay },
		stage: previous.stage === "prepared" ? "prepared" : "repairing",
	});
	return true;
});
