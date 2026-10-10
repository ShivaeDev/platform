import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { type Checks, FleetFailure, type Review, type WorkResult } from "#policy.ts";
import { pathsOverlap } from "#storage/admission.ts";
export function validateResult(record: FleetRecord, result: WorkResult) {
	const valid =
		result.kind === "no-change"
			? result.evidence.length > 0
			: result.paths.length > 0
				&& result.paths.every((path) =>
					record.preparation.ownedPaths.some((owned) => owned === "." || path === owned || path.startsWith(`${owned}/`)),
				)
				&& result.paths.every((path) => !(path.startsWith("/") || path.split("/").some((part) => ["", ".", ".."].includes(part))));
	return valid ? Effect.void : Effect.fail(new FleetFailure({ message: "Result needs evidence and known reserved scope", reason: "invalid" }));
}
export function validateReview(record: FleetRecord, review: Review, head: string) {
	return review.head === head
		&& review.evidence.length > 0
		&& !record.attempts.some((attempt) => attempt.role !== "reviewer" && attempt.receipt?.sessionId === review.receipt.sessionId)
		? Effect.void
		: Effect.fail(new FleetFailure({ message: "Independent review must bind evidence to the actual head", reason: "invalid" }));
}
export function validateChecks(checks: Checks, head: string) {
	return checks.head === head && checks.passed && checks.evidence.length > 0
		? Effect.void
		: Effect.fail(new FleetFailure({ message: "Required validation has not passed for the actual head", reason: "invalid" }));
}
export const overlaps = pathsOverlap;
