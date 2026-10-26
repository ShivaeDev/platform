import { Effect } from "effect";
import { admit } from "#admit.ts";
import { workRevision } from "#board/workRevision.ts";
import { areaWaiters } from "#engine/areaWaiters.ts";
import { invalidPriorReview } from "#engine/invalidPriorReview.ts";
import { launchObservationRetries } from "#engine/launchObservationRetries.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileAttempt } from "#engine/reconcileAttempt.ts";
import { reviewChecks } from "#engine/reviewChecks.ts";
import { reviewContext } from "#engine/reviewContext.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import type { Versioned } from "#storage/model.ts";

export function obtainReview(state: EngineState) {
	const { store, sessions, save, board } = state;
	return Effect.fn("Fleet.obtainReview")(function* (
		stored: Versioned<FleetRecord>,
		work: BoardWork,
		result: WorkResult,
		retry?: {
			readonly prompt: string;
			readonly sessionId: string;
			readonly observationRetries?: number;
		},
	) {
		const policy = yield* state.current;
		if (stored.value.review?.head === result.head) {
			return stored.value.review.receipt;
		}
		const previous = stored.value.attempts.at(-1);
		const previousHead = reviewAttemptHead(stored.value, previous);
		const unusable = yield* invalidPriorReview(stored.value, previous, result.head);
		if (reusableReview(previous, work, result.head, previousHead, unusable)) {
			return previous.receipt ?? (yield* reconcileAttempt(state)(stored, previous));
		}
		const reviewerGuidance = yield* policyGuidance(policy, "reviewer");
		const prompt =
			retry?.prompt
			?? reviewerPrompt({
				result,
				...(reviewerGuidance === undefined ? {} : { reviewerGuidance }),
				...(policy.sharedEnvironment === undefined ? {} : { sharedEnvironment: policy.sharedEnvironment }),
				checks: yield* reviewChecks(state, work, result),
				task: yield* reviewContext(stored.value, work, board.get),
			});

		const settings = { ...policy.launch };
		const attempt: Attempt = {
			observationRetries: launchObservationRetries(stored.value, retry?.observationRetries),
			operationId: policy.operationId(),
			prompt,
			providerFailures: stored.value.launchRetry?.rejections,
			reviewHead: result.head,
			reviewRevision: workRevision(work.revision, work.context),
			role: "reviewer",
			sessionId: retry?.sessionId,
			settings,
			status: "submitting",
			submittedAt: policy.now(),
		};
		const quota = yield* policy.refreshQuota === undefined ? Effect.succeed(policy.quota) : policy.refreshQuota();
		yield* admit(
			work,
			(yield* store.list()).map(({ value }) => value),
			{ ...policy, quota },
			board.get,
		);
		yield* save(
			stored,
			{
				...stored.value,
				attempts: [...stored.value.attempts, attempt],
				launchRetry: undefined,
				mergeAreasReleased: undefined,
				mergeReadyAt: undefined,
				mergeReadyHead: undefined,
			},
			{ areaWaiters: yield* areaWaiters(state, stored.value), quota, role: "reviewer" },
		);
		const input = {
			access: "read-only",
			cwd: stored.value.cwd,
			operationId: attempt.operationId,
			prompt,
			settings,
		} as const;
		return yield* (retry === undefined ? sessions.start(input) : sessions.continue({ ...input, sessionId: retry.sessionId })).pipe(
			Effect.tapError((error) =>
				submissionFailure(state, stored.value.workId, attempt.operationId, error, "Restore provider access and retry this review"),
			),
		);
	});
}

function reviewAttemptHead(record: FleetRecord, attempt: Attempt | undefined) {
	const review = record.review;
	const reviewedHead =
		review !== undefined && review.receipt.sessionId === attempt?.receipt?.sessionId && review.receipt.turnId === attempt?.receipt?.turnId
			? review.head
			: undefined;
	return attempt?.reviewHead ?? reviewedHead;
}

export function reviewMatchesBrief(attempt: Attempt | undefined, work: BoardWork): boolean {
	return attempt?.reviewRevision === undefined || attempt.reviewRevision === workRevision(work.revision, work.context);
}

function reusableReview(
	previous: Attempt | undefined,
	work: BoardWork,
	head: string,
	previousHead: string | undefined,
	unusable: boolean,
): previous is Attempt {
	return (
		previous?.role === "reviewer"
		&& !(unusable || ["failed", "interrupted"].includes(previous.status))
		&& (previous.status !== "completed" || reviewMatchesBrief(previous, work))
		&& (previousHead === undefined || previousHead === head)
	);
}
