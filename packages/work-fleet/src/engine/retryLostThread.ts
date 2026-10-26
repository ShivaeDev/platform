import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { retireUnacknowledged } from "#engine/retireUnacknowledged.ts";
import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export const retryLostThread = Effect.fn("Fleet.retryLostThread")(function* (state: EngineState, stored: Versioned<FleetRecord>, error: unknown) {
	const record = stored.value;
	const attempt = record.attempts.at(-1);
	if (
		!(error instanceof SessionFailure)
		|| error.reason !== "ambiguous"
		|| error.code === "duplicate-turns"
		|| attempt === undefined
		|| attempt.role === "reviewer"
		|| attempt.status !== "submitting"
		|| attempt.sessionId !== undefined
		|| attempt.receipt !== undefined
		|| state.launching.has(attempt.operationId)
		|| record.attempts.slice(0, -1).some((entry) => ["submitting", "accepted", "running"].includes(entry.status))
	) {
		return undefined;
	}
	const message = error.message;
	function askOrchestrator(explanation: string) {
		return state.decision(
			stored,
			failureCode(error),
			`${message}; ${explanation}; execution ownership retained`,
			"Inspect the lost thread and published work before starting a fresh thread or safely releasing",
		);
	}
	if (
		record.result !== undefined
		|| record.report !== undefined
		|| record.attempts.some((entry) => entry.output?.trim() || (entry.terminalReceipts?.length ?? 0) > 0)
	) {
		return yield* askOrchestrator("recorded worker output prevents automatic fresh-thread restart");
	}
	const rejections = (attempt.providerFailures ?? 0) + 1;
	if (rejections >= 5) {
		return yield* askOrchestrator("automatic fresh-thread restart limit reached after 4 restarts");
	}
	if (state.integrations.publication === undefined) {
		return undefined;
	}
	const work = yield* state.board.get(record.workId, { fresh: true });
	yield* authorizeBriefContext(record, work);
	const observed = yield* state.integrations.publication(work).pipe(Effect.result);
	if (observed._tag === "Failure") {
		return yield* askOrchestrator(`cannot determine published work: ${observed.failure.message}`);
	}
	const publication = observed.success;
	if (publication.remoteBranch || publication.pullRequest !== undefined) {
		return yield* askOrchestrator(`published work may belong to the lost thread: ${publication.pullRequest ?? publication.branch}`);
	}
	const rejectedAt = state.policy.now();
	const reason = `${error.message}; no remote branch ${publication.branch}, PR or recorded worker output; automatically restart on a fresh thread (${rejections} of 4)`;
	return yield* retireUnacknowledged(state, {
		...stored,
		value: {
			...record,
			attempts: record.attempts.map((entry) =>
				entry.operationId === attempt.operationId
					? { ...entry, abandoned: { at: rejectedAt, observationError: reason }, readRetry: undefined, sessionUnusable: true }
					: entry,
			),
			blocker: reason,
			launchRetry: { rejectedAt, rejections, retryAt: rejectedAt + Math.min(300_000, 30_000 * 2 ** (rejections - 1)) },
			step: attempt.role === "repair" ? "repairing" : "queued",
		},
	});
});
