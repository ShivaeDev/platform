import { Effect, Result } from "effect";
import { admit } from "#admit.ts";
import { workRevision } from "#board/workRevision.ts";
import { areaWaiters } from "#engine/areaWaiters.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reviewChecks } from "#engine/reviewChecks.ts";
import { reviewContext } from "#engine/reviewContext.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { reviewDocument } from "#prompt/reviewDocument.ts";
import { readReviewerVerdict, reviewerPrompt } from "#prompt/reviewer.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function readOrContinueReview(state: EngineState) {
	return Effect.fn("Fleet.readOrContinueReview")(function* (
		stored: Versioned<FleetRecord>,
		work: BoardWork,
		result: WorkResult,
		receipt: SessionReceipt,
		output: string,
	) {
		const content = reviewDocument(output);
		const publication = yield* state.board.report(work, { execution: "completed", output: content.output, provisioning: "ready", receipt }, "review");
		const document = { publication, tldr: content.tldr };
		const parsed = yield* readReviewerVerdict(output, receipt).pipe(Effect.result);
		if (Result.isSuccess(parsed)) {
			return { ...parsed.success, document, head: stored.value.reviewAdvisoryHead === result.head ? result.head : parsed.success.head };
		}
		if (stored.value.reviewAdvisoryHead === result.head) {
			return {
				document,
				evidence: ["Reviewer reply retained in the Board document"],
				findings: [],
				head: result.head,
				receipt,
				repairPrompt: "",
				verdict: "unavailable" as const,
			};
		}
		const turns = stored.value.attempts.filter(
			(attempt) => attempt.role === "reviewer" && (attempt.sessionId ?? attempt.receipt?.sessionId) === receipt.sessionId,
		);
		if (turns.length > 1) {
			return yield* Effect.fail(parsed.failure);
		}
		yield* continueReview(state)(stored, work, result, receipt);
		return undefined;
	});
}

function continueReview(state: EngineState) {
	return Effect.fn("Fleet.continueReview")(function* (stored: Versioned<FleetRecord>, work: BoardWork, result: WorkResult, receipt: SessionReceipt) {
		const { store, board, save, sessions } = state;
		const policy = yield* state.current;
		const reviewerGuidance = yield* policyGuidance(policy, "reviewer");
		const prompt = [
			reviewerPrompt({
				result,
				...(reviewerGuidance === undefined ? {} : { reviewerGuidance }),
				...(policy.sharedEnvironment === undefined ? {} : { sharedEnvironment: policy.sharedEnvironment }),
				checks: yield* reviewChecks(state, work, result),
				task: yield* reviewContext(stored.value, work, board.get),
			}),
			"Your previous reply did not contain a parseable verdict. Use the evidence you already inspected and end with exactly one FLEET_REVIEW: JSON line in the required format above. This is the only automatic follow-up; unavailable CI logs or artifacts alone must not withhold a verdict.",
		].join("\n");
		const settings = { ...policy.launch };
		const attempt: Attempt = {
			operationId: policy.operationId(),
			prompt,
			reviewHead: result.head,
			reviewRevision: workRevision(work.revision, work.context),
			role: "reviewer",
			sessionId: receipt.sessionId,
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
			{ ...stored.value, attempts: [...stored.value.attempts, attempt] },
			{ areaWaiters: yield* areaWaiters(state, stored.value), quota, role: "reviewer" },
		);
		yield* sessions
			.continue({ access: "read-only", operationId: attempt.operationId, prompt, sessionId: receipt.sessionId, settings })
			.pipe(
				Effect.catch((error) =>
					submissionFailure(state, stored.value.workId, attempt.operationId, error, "Restore provider access and retry this review"),
				),
			);
	});
}
