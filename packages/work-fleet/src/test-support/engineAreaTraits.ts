import { Effect } from "effect";
import { Conflict, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function deliveryChangesAfterAreaRelease() {
	return engineConfiguration("delivery can change after the area reservation expires", (state) => {
		state.deliveryChanged = false;
		return {
			areaMergeWaitMs: 5000,
			backlog: 3,
			deliveryQuery: () => (state.deliveryChanged ? Effect.fail(new Forbidden({ message: "PR closed without merging" })) : Effect.succeed(undefined)),
		};
	});
}
export function deliveryEvidenceCanDisappear() {
	return engineConfiguration("valid delivery evidence can disappear before the area wait expires", (state) => {
		state.deliveryChanged = false;
		return {
			areaMergeWaitMs: 5000,
			deliveryQuery: () => (state.deliveryChanged ? Effect.fail(new Conflict({ message: "PR head moved" })) : Effect.succeed(undefined)),
		};
	});
}
export function humanMergeCanArriveLate() {
	return engineConfiguration("a human merge can arrive after the area wait expires", (state) => {
		state.deliveryMerged = false;
		return {
			deliveryQuery: (result) => Effect.succeed(state.deliveryMerged ? { head: result.head, revision: "merged", url: result.pr } : undefined),
		};
	});
}
export function mergeWaitIsFiveSeconds() {
	return engineConfiguration("human delivery releases areas after five seconds of readiness", () => ({
		areaMergeWaitMs: 5000,
		denyDelivery: true,
	}));
}
export function reviewOutlivesMergeWait() {
	return engineConfiguration("an unfinished review outlives the configured merge wait", () => ({ areaMergeWaitMs: 5000, reviewRunning: true }));
}
export function continuedWorkHasExpiredAreas() {
	return engineConfiguration("continued human delivery has an expired area reservation", () => ({
		areaMergeWaitMs: 5000,
		backlog: 3,
		denyDelivery: true,
	}));
}
export function deliveryObservationFailsOnce() {
	return engineConfiguration("delivery observation fails once and time can advance", () => ({ deliveryFailure: true }));
}
