import { Effect } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { transientFailure } from "#session/transientFailure.ts";
import type { Versioned } from "#storage/model.ts";

export const readRetry = Effect.fn("Fleet.readRetry")(function* (state: EngineState, current: Versioned<FleetRecord>, error: unknown) {
	if (!(error instanceof SessionFailure && transientFailure(error))) {
		return undefined;
	}
	if (current.value.launchRetry !== undefined) {
		return current;
	}
	const attempt = current.value.attempts.at(-1);
	if (attempt === undefined || !["submitting", "accepted", "running"].includes(attempt.status)) {
		return undefined;
	}
	const failures = (attempt.readRetry?.failures ?? 0) + 1;
	const retryAt = state.policy.now() + 30_000 * 2 ** (failures - 1);
	const saved = yield* state.save(current, {
		...current.value,
		attempts: current.value.attempts.map((item) =>
			item.operationId === attempt.operationId
				? { ...item, readRetry: failures < 5 ? { error: error.message, failures, retryAt } : undefined }
				: item,
		),
		attentionOwner: "automation",
		blocker: `Waiting to read provider state: ${error.message}; read attempt ${failures} of 5; retry after ${new Date(retryAt).toISOString()}`,
	});
	return failures < 5
		? saved
		: yield* state.decision(
				saved,
				failureCode(error),
				`${error.message}; provider read failure after ${failures} attempts (${failures - 1} automatic retries); execution ownership retained`,
				"Restore provider reads and reconcile this existing operation before retrying or releasing",
			);
});
