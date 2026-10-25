import { Effect } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function boardAcknowledgementFailsOnce() {
	return engineConfiguration("the Board loses its first acknowledgement", () => ({ acknowledgeFailure: true }));
}
export function noChangeChecksFailOnce() {
	return engineConfiguration("no-change validation fails once", () => ({ checksFailure: true, noChange: true }));
}
export function checksRequestRepair() {
	return engineConfiguration("failed checks request a scoped repair", () => ({ checkRepair: true, checksFailure: true }));
}
export function reviewAndChecksRequestRepairs(guidance?: string) {
	return engineConfiguration("review and checks each request a repair", () => ({
		checkRepair: true,
		checksFailure: true,
		repairs: true,
		...(guidance === undefined ? {} : { workerGuidance: guidance }),
	}));
}
export function archiveFailsOnce() {
	return engineConfiguration("session archival fails once", () => ({ archiveFailure: true }));
}
export function workerTurnRejected() {
	return engineConfiguration("the provider rejects the worker's first turn", () => ({ rejectTurn: true }));
}
export function executionLimit(concurrency: number) {
	return engineConfiguration(`Fleet permits ${concurrency} executing work items`, () => ({ concurrency }));
}
export function workerAnswerAcknowledgementLost() {
	return engineConfiguration("the worker answer loses its acceptance acknowledgement", () => ({ lostContinuationAcknowledgement: true }));
}
export function foreignPullRequest() {
	return engineConfiguration("the reported PR belongs to another repository", () => ({
		resultQuery: () =>
			Effect.fail(withFailureContext(new BadRequest({ message: "Reported PR must belong to the host repository" }), { code: "foreign-pr" })),
	}));
}
export function workerGuidance(guidance: string) {
	return engineConfiguration("workers receive repository guidance", () => ({ workerGuidance: guidance }));
}
