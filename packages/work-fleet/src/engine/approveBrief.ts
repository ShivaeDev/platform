import { Effect } from "effect";
import { workRevision } from "#board/workRevision.ts";
import { authorizeBrief, briefChanged } from "#engine/boardBrief.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { launchPrompt } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { briefSteerIntent, steerBrief } from "#engine/steerBrief.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { BoardWork, DecisionResponse } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function approveBrief(state: EngineState) {
	return Effect.fn("Fleet.approveBrief")(function* (
		input: Versioned<FleetRecord>,
		work: BoardWork,
		prompt?: string,
		responses?: readonly DecisionResponse[],
	) {
		yield* authorizeBrief(work);
		const stored = yield* ensurePublication(state)(input);
		const record = stored.value;
		const published = record.decision?.published;
		const approvedPrompt = prompt ?? revisedPrompt(record, work);
		const updated: FleetRecord = {
			...record,
			areas: work.areas,
			attempts: record.attempts.map((attempt) =>
				attempt.role === "reviewer" && attempt.reviewRevision === undefined
					? { ...attempt, reviewRevision: workRevision(record.boardRevision, record.boardContext) }
					: attempt,
			),
			blocker: undefined,
			boardContext: work.context,
			boardRevision: work.revision,
			boardSourcePath: work.sourcePath,
			checks: undefined,
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			launchRetry: revisedRetry(record, approvedPrompt, state.policy.workerGuidance),
			mergeAreasReleased: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			prompt: approvedPrompt,
			responses: responses ?? record.responses,
			review: undefined,
			stage: resumedStage(record),
			supersededDecisions:
				published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		};
		const approved = yield* state.save(stored, briefSteerIntent(record, updated, state.policy.now())).pipe(Effect.flatMap(closeDecisions(state)));
		return yield* steerBrief(state, approved, record);
	});
}

function revisedPrompt(record: FleetRecord, work: BoardWork) {
	return record.boardContext && record.prompt.includes(record.boardContext)
		? record.prompt.replace(record.boardContext, () => work.context)
		: work.context;
}

function resumedStage(record: FleetRecord): FleetRecord["stage"] {
	if (record.stage === "adopting") {
		return "adopting";
	}
	const latest = record.attempts.at(-1);
	if (executing(record)) {
		return latest?.role === "reviewer" ? "reviewing" : "executing";
	}
	if (latest?.role !== "reviewer" && latest?.status === "completed") {
		return "executing";
	}
	if (record.result !== undefined) {
		return "reviewing";
	}
	return "prepared";
}

export function approveDispatchedBrief(state: EngineState, stored: Versioned<FleetRecord>, work: BoardWork, prompt?: string) {
	const record = stored.value;
	return !["completed", "released"].includes(record.stage)
		&& briefChanged(record, work)
		&& (prompt !== undefined || (record.stage !== "prepared" && record.attempts.length > 0))
		? approveBrief(state)(stored, work, prompt)
		: Effect.succeed(stored);
}

function revisedRetry(record: FleetRecord, prompt: string, guidance?: string) {
	return record.launchRetry === undefined
		? undefined
		: {
				...record.launchRetry,
				prompt: launchPrompt(record, prompt, undefined, guidance),
			};
}
