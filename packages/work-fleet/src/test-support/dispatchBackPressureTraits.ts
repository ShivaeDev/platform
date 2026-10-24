import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function openPullRequestCurve(controls: {
	readonly curve: () => { readonly concurrency: 4; readonly openPullRequests: { readonly ease: 1; readonly floor: 0; readonly max: 3 } };
}) {
	return (): EngineOptions => ({ backlog: 100, denyDelivery: true, ...controls.curve() });
}

export function mergeablePullRequestCurve(controls: {
	readonly merged: () => Set<string>;
	readonly curve: () => { readonly concurrency: 4; readonly openPullRequests: { readonly ease: 1; readonly floor: 0; readonly max: 3 } };
}) {
	return (): EngineOptions => ({
		backlog: 100,
		deliveryQuery: (result) =>
			Effect.succeed(controls.merged().has(result.head) ? { head: result.head, revision: "merged", url: result.pr } : undefined),
		...controls.curve(),
	});
}

export function repairAtPullRequestLimitConfiguration() {
	return (): EngineOptions => ({
		concurrency: 3,
		denyDelivery: true,
		openPullRequests: { ease: 0, floor: 0, max: 1 },
		repairs: true,
	});
}
export function answerAtPullRequestLimitConfiguration() {
	return (): EngineOptions => ({
		concurrency: 3,
		denyDelivery: true,
		openPullRequests: { ease: 0, floor: 0, max: 1 },
	});
}
