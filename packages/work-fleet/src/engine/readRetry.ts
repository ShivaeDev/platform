import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { transientFailure } from "#session/transientFailure.ts";
import type { Versioned } from "#storage/model.ts";

function retryKind(error: unknown, record: FleetRecord) {
	if (error instanceof SessionFailure && retryProviderRead(error, record)) {
		return "provider";
	}
	return (error instanceof ServiceUnavailable && failureContext(error).retryable !== false)
		|| (error instanceof BoardFailure && error.code === "incomplete-observation")
		? "integration"
		: undefined;
}

function retryProviderRead(error: SessionFailure, record: FleetRecord) {
	return (
		transientFailure(error)
		|| (error.reason === "unavailable" && record.attempts.at(-1)?.submissionUncertain === true)
		|| (error.reason === "ambiguous"
			&& (error.code === "session-unavailable" || (record.attempts.at(-1)?.readRetry !== undefined && error.code !== "duplicate-turns")))
	);
}

function retryAttempts(record: FleetRecord, operationId: string | undefined, retry: Attempt["readRetry"], uncertainOperationId?: string) {
	return record.attempts.map((attempt) =>
		attempt.operationId === operationId
			? { ...attempt, readRetry: retry, ...(attempt.operationId === uncertainOperationId ? { submissionUncertain: true } : {}) }
			: attempt,
	);
}

export const readRetry = Effect.fn("Fleet.readRetry")(function* (
	state: EngineState,
	current: Versioned<FleetRecord>,
	error: unknown,
	uncertainOperationId?: string,
) {
	const kind = retryKind(error, current.value);
	if (kind === undefined) {
		return undefined;
	}
	if (current.value.decision !== undefined) {
		return current;
	}
	if (current.value.launchRetry !== undefined) {
		return current;
	}
	const attempt = current.value.attempts.at(-1);
	if (kind === "provider" && (attempt === undefined || !["submitting", "accepted", "running"].includes(attempt.status))) {
		return undefined;
	}
	const previous = kind === "provider" ? attempt?.readRetry : current.value.integrationRetry;
	if (previous !== undefined && state.policy.now() < previous.retryAt) {
		return current;
	}
	const failures = (previous?.failures ?? 0) + 1;
	const retryAt = state.policy.now() + 30_000 * 2 ** (failures - 1);
	const message = failureMessage(error);
	const subject = { integration: "integration evidence", provider: "provider state" }[kind];
	const retry = failures < 5 ? { error: message, failures, retryAt } : undefined;
	const saved = yield* state.save(current, {
		...current.value,
		attempts: kind === "provider" ? retryAttempts(current.value, attempt?.operationId, retry, uncertainOperationId) : current.value.attempts,
		attentionOwner: "automation",
		blocker: `Waiting to read ${subject}: ${message}; read attempt ${failures} of 5; retry after ${new Date(retryAt).toISOString()}`,
		integrationRetry: kind === "integration" ? retry : current.value.integrationRetry,
	});
	return failures < 5
		? saved
		: yield* state
				.decision(
					saved,
					failureCode(error),
					`${message}; ${kind} read failure after ${failures} attempts (${failures - 1} automatic retries); execution ownership retained`,
					"Restore integration reads and reconcile this existing work before retrying or releasing",
					undefined,
					failureContext(error).attentionOwner,
				)
				.pipe(Effect.catchTag("BoardFailure", () => state.load(current.value.workId)));
});

export function retryPending(state: EngineState, record: FleetRecord) {
	return [record.integrationRetry, record.attempts.at(-1)?.readRetry].some((retry) => retry !== undefined && state.policy.now() < retry.retryAt);
}

export const clearIntegrationRetry = Effect.fn("Fleet.clearIntegrationRetry")(function* (state: EngineState, current: Versioned<FleetRecord>) {
	if (current.value.integrationRetry === undefined) {
		return current;
	}
	return yield* state.save(current, { ...current.value, integrationRetry: undefined });
});
