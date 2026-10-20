import { Effect, Result } from "effect";
import { validateReview } from "#completion.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { readReviewerVerdict } from "#prompt/reviewer.ts";

export const invalidPriorReview = Effect.fn("Fleet.invalidPriorReview")(function* (record: FleetRecord, previous: Attempt | undefined, head: string) {
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

export function stalledReviewRetry(previous: Attempt | undefined, now: number) {
	return previous?.role === "reviewer"
		&& previous.status === "interrupted"
		&& previous.stallRecovery?.interruptRequestedAt !== undefined
		&& previous.receipt !== undefined
		? { prompt: previous.prompt ?? "Continue the review", sessionId: previous.receipt.sessionId, stallRecovery: { count: 2, lastActionAt: now } }
		: undefined;
}
