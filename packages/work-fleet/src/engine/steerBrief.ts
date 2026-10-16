import { Effect, Result } from "effect";
import { workRevision } from "#board/workRevision.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { briefEditPrompt } from "#prompt/briefEdit.ts";
import type { Versioned } from "#storage/model.ts";

export function briefSteerIntent(previous: FleetRecord, record: FleetRecord, requestedAt: number): FleetRecord {
	const revision = workRevision(record.boardRevision, record.boardContext);
	const attempt = record.attempts.at(-1);
	if (
		revision === workRevision(previous.boardRevision, previous.boardContext)
		|| record.stage !== "executing"
		|| attempt?.receipt === undefined
		|| attempt.role === "reviewer"
		|| !["accepted", "running"].includes(attempt.status)
		|| attempt.briefSteers?.some((entry) => entry.revision === revision)
	) {
		return record;
	}
	return {
		...record,
		attempts: record.attempts.map((entry) =>
			entry.operationId === attempt.operationId ? { ...entry, briefSteers: [...(entry.briefSteers ?? []), { requestedAt, revision }] } : entry,
		),
	};
}

export const steerBrief = Effect.fn("Fleet.steerBrief")(function* (state: EngineState, stored: Versioned<FleetRecord>, previous: FleetRecord) {
	const record = stored.value;
	const revision = workRevision(record.boardRevision, record.boardContext);
	const attempt = record.attempts.at(-1);
	const intent = attempt?.briefSteers?.find((entry) => entry.revision === revision);
	if (
		attempt?.receipt === undefined
		|| intent === undefined
		|| previous.attempts.some((entry) => entry.operationId === attempt.operationId && entry.briefSteers?.some((saved) => saved.revision === revision))
	) {
		return stored;
	}
	const result = yield* state.sessions
		.steer(attempt.receipt, briefEditPrompt(previous.boardContext, record.boardContext ?? record.prompt))
		.pipe(Effect.result);
	const evidence = Result.isFailure(result) ? { error: result.failure.message } : { steeredAt: state.policy.now() };
	const current = yield* state.load(record.workId);
	return yield* state.save(current, {
		...current.value,
		attempts: current.value.attempts.map((entry) =>
			entry.operationId === attempt.operationId
				? { ...entry, briefSteers: entry.briefSteers?.map((saved) => (saved.revision === revision ? { ...saved, ...evidence } : saved)) }
				: entry,
		),
	});
});
