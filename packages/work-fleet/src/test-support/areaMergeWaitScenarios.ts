import { Effect } from "effect";
import { engineScenario } from "#test/engineScenario.ts";

export function humanMergeCanArriveLate() {
	return engineScenario("a human merge can arrive after the area wait expires", () => {
		let now = 100;
		let merged = false;
		return {
			context: {
				get merged() {
					return merged;
				},
				set merged(value: typeof merged) {
					merged = value;
				},
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: {
				deliveryQuery: (result) => Effect.succeed(merged ? { head: result.head, revision: "merged", url: result.pr } : undefined),
				now: () => now,
			},
		};
	});
}
export function mergeWaitIsFiveSeconds() {
	return engineScenario("human delivery releases areas after five seconds of readiness", () => {
		let now = 100;
		return {
			context: {
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: { areaMergeWaitMs: 5000, denyDelivery: true, now: () => now },
		};
	});
}
export function reviewOutlivesMergeWait() {
	return engineScenario("an unfinished review outlives the configured merge wait", () => {
		let now = 100;
		return {
			context: {
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: { areaMergeWaitMs: 5000, now: () => now, reviewRunning: true },
		};
	});
}
