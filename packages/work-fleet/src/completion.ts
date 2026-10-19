import { Effect } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetRecord } from "#model.ts";
import type { Checks, Review, WorkResult } from "#policy.ts";
export function validateResult(record: FleetRecord, result: WorkResult) {
	const valid =
		result.kind === "no-change"
			? result.evidence.length > 0
			: result.paths.length > 0
				&& result.paths.every((path) =>
					record.preparation.ownedPaths.some((owned) => owned === "." || path === owned || path.startsWith(`${owned}/`)),
				)
				&& result.paths.every((path) => !(path.startsWith("/") || path.split("/").some((part) => ["", ".", ".."].includes(part))));
	return valid ? Effect.void : Effect.fail(new BadRequest({ message: "Result needs evidence and known reserved scope" }));
}
export function validateReview(record: FleetRecord, review: Review, head: string) {
	return review.head === head
		&& review.evidence.length > 0
		&& !record.attempts.some((attempt) => attempt.role !== "reviewer" && attempt.receipt?.sessionId === review.receipt.sessionId)
		? Effect.void
		: Effect.fail(new BadRequest({ message: "Independent review must bind evidence to the actual head" }));
}
export function reviewSatisfied(record: FleetRecord, head: string): boolean {
	return record.reviewSkippedHead === head || (record.review?.verdict === "approved" && record.review.head === head);
}
export function validateReviewRequirement(record: FleetRecord, head: string) {
	if (record.reviewSkippedHead === head) {
		return Effect.void;
	}
	return record.review?.verdict === "approved"
		? validateReview(record, record.review, head)
		: Effect.fail(new BadRequest({ message: "Independent review has not approved the actual head" }));
}
export function validateChecks(checks: Checks, head: string) {
	return checks.head === head && checks.passed && !checks.pending && checks.evidence.length > 0
		? Effect.void
		: Effect.fail(new BadRequest({ message: "Required validation has not passed for the actual head" }));
}
