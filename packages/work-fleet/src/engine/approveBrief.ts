import { Effect } from "effect";
import { workRevision } from "#board/workRevision.ts";
import { abandonStalled } from "#engine/abandonStalled.ts";
import { authorizeBrief, briefChanged } from "#engine/boardBrief.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { refuseDeliveredId } from "#engine/deliveredId.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { launchPrompt } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { revisedPrompt } from "#engine/revisedPrompt.ts";
import { briefSteerIntent, steerBrief } from "#engine/steerBrief.ts";
import { allAttempts, executing, type FleetRecord } from "#model.ts";
import type { BoardWork, DecisionResponse } from "#policy.ts";
import { briefEditPrompt } from "#prompt/briefEdit.ts";
import { workerBriefText } from "#prompt/task.ts";
import type { Versioned } from "#storage/model.ts";

export function approveBrief(state: EngineState) {
	return Effect.fn("Fleet.approveBrief")(function* (
		input: Versioned<FleetRecord>,
		work: BoardWork,
		prompt?: string,
		responses?: readonly DecisionResponse[],
		preserveDecision = false,
	) {
		yield* authorizeBrief(work);
		yield* refuseDeliveredId(state, work);
		const stored = yield* ensurePublication(state)(input).pipe(Effect.flatMap((current) => abandonStalled(state, current)));
		const record = stored.value;
		const approvedPrompt = prompt ?? (yield* revisedPrompt(record, work, state.board.get));
		const updated: FleetRecord = {
			...record,
			...approvedDecision(record, state.policy.now(), preserveDecision),
			areaQueuedAt: record.step === "queued" ? state.policy.now() : record.areaQueuedAt,
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
			launchRetry: revisedRetry(record, approvedPrompt, state.policy.workerGuidance),
			mergeAreasReleased: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			pendingAnswers: revisedAnswers(record, work, approvedPrompt),
			prompt: approvedPrompt,
			queuePriority: work.priority,
			responses: responses ?? record.responses,
			review: undefined,
			sweep: record.attempts.length === 0 ? work.sweep : (record.sweep ?? work.sweep),
		};
		const approved = yield* state.save(stored, briefSteerIntent(record, updated, state.policy.now())).pipe(Effect.flatMap(closeDecisions(state)));
		return yield* steerBrief(state, approved, record);
	});
}

function resumedStage(record: FleetRecord): FleetRecord["step"] {
	if (record.step === "adopting") {
		return "adopting";
	}
	const latest = record.attempts.at(-1);
	if (executing(record)) {
		return latest?.role === "reviewer" ? "reviewing" : "working";
	}
	if (latest?.role !== "reviewer" && latest?.status === "completed") {
		return "working";
	}
	if (record.result !== undefined) {
		return "reviewing";
	}
	return "queued";
}

export function approveDispatchedBrief(state: EngineState, stored: Versioned<FleetRecord>, work: BoardWork, prompt?: string) {
	const record = stored.value;
	return !["done", "released"].includes(record.step)
		&& briefChanged(record, work)
		&& (prompt !== undefined || (record.step !== "queued" && record.attempts.length > 0))
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

function revisedAnswers(record: FleetRecord, work: BoardWork, prompt: string) {
	const hasWorkerTurn = allAttempts(record).some((attempt) => attempt.role !== "reviewer" && attempt.receipt !== undefined);
	return briefChanged(record, work) && !executing(record) && hasWorkerTurn
		? [...(record.pendingAnswers ?? []), briefEditPrompt(record.boardContext, work.context, workerBriefText(prompt, work.context))]
		: record.pendingAnswers;
}

function approvedDecision(record: FleetRecord, now: number, preserve: boolean) {
	if (preserve) {
		return {};
	}
	const published = record.decision?.published;
	return {
		decision: undefined,
		decisionAcknowledged: undefined,
		decisionPublished: undefined,
		step: resumedStage(record),
		supersededDecisions:
			published === undefined ? record.supersededDecisions : [...(record.supersededDecisions ?? []), { published, supersededAt: now }],
	};
}
