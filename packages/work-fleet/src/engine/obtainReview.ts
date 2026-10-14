import { Effect, Result } from "effect";
import { admit } from "#admit.ts";
import { workRevision } from "#board/workRevision.ts";
import { validateReview } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileAttempt } from "#engine/reconcileAttempt.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { readReviewerVerdict, reviewerPrompt } from "#prompt/reviewer.ts";
import type { Versioned } from "#storage/model.ts";

export function obtainReview(state: EngineState) {
	const { store, policy, sessions, save, board } = state;
	return Effect.fn("Fleet.obtainReview")(function* (
		stored: Versioned<FleetRecord>,
		work: BoardWork,
		result: WorkResult,
		retry?: {
			readonly prompt: string;
			readonly sessionId: string;
			readonly stallRecovery: Attempt["stallRecovery"];
			readonly observationRetries?: number;
		},
	) {
		if (stored.value.review?.head === result.head) {
			return stored.value.review.receipt;
		}
		const previous = stored.value.attempts.at(-1);
		const continuation = retry ?? stalledReviewRetry(previous, policy.now());
		const previousHead = reviewAttemptHead(stored.value, previous);
		const unusable = yield* invalidPriorReview(stored.value, previous, result.head);
		if (reusableReview(previous, work, result.head, previousHead, unusable)) {
			return previous.receipt ?? (yield* reconcileAttempt(state)(stored, previous));
		}
		const reviewerGuidance = yield* policyGuidance(policy, "reviewer");
		const prompt =
			continuation?.prompt
			?? reviewerPrompt({
				result,
				...(reviewerGuidance === undefined ? {} : { reviewerGuidance }),
				...(policy.sharedEnvironment === undefined ? {} : { sharedEnvironment: policy.sharedEnvironment }),
				task: work.context,
			});

		const settings = { ...policy.launch };
		const attempt: Attempt = {
			observationRetries: retry?.observationRetries,
			operationId: policy.operationId(),
			prompt,
			providerFailures: stored.value.launchRetry?.rejections,
			reviewHead: result.head,
			reviewRevision: workRevision(work.revision, work.context),
			role: "reviewer",
			sessionId: continuation?.sessionId,
			settings,
			stallRecovery: continuation?.stallRecovery,
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
			{ quota, role: "reviewer" },
		);
		const input = {
			access: "read-only",
			cwd: stored.value.cwd,
			operationId: attempt.operationId,
			prompt,
			settings,
		} as const;
		return yield* (continuation === undefined ? sessions.start(input) : sessions.continue({ ...input, sessionId: continuation.sessionId })).pipe(
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

const invalidPriorReview = Effect.fn("Fleet.invalidPriorReview")(function* (record: FleetRecord, previous: Attempt | undefined, head: string) {
	if (
		record.responses?.at(-1)?.action !== "retry"
		|| previous?.status !== "completed"
		|| previous.role !== "reviewer"
		|| previous.receipt === undefined
	) {
		return false;
	}
	const parsed = yield* readReviewerVerdict(previous.output ?? "", previous.receipt).pipe(
		Effect.tap((review) => validateReview(record, review, head)),
		Effect.result,
	);
	return Result.isFailure(parsed);
});

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

function stalledReviewRetry(previous: Attempt | undefined, now: number) {
	return previous?.role === "reviewer"
		&& previous.status === "interrupted"
		&& previous.stallRecovery?.interruptRequestedAt !== undefined
		&& previous.receipt !== undefined
		? { prompt: previous.prompt ?? "Continue the review", sessionId: previous.receipt.sessionId, stallRecovery: { count: 2, lastActionAt: now } }
		: undefined;
}
