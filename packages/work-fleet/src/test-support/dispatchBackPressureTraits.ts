import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function openPullRequestCurve(controls: {
	readonly curve: () => { readonly concurrency: 4; readonly openPullRequests: { readonly ease: 1; readonly floor: 0; readonly max: 3 } };
}) {
	return engineConfiguration("open pull request curve", () => ({ backlog: 100, denyDelivery: true, ...controls.curve() }));
}

export function mergeablePullRequestCurve(controls: {
	readonly merged: () => Set<string>;
	readonly curve: () => { readonly concurrency: 4; readonly openPullRequests: { readonly ease: 1; readonly floor: 0; readonly max: 3 } };
}) {
	return engineConfiguration("mergeable pull request curve", () => ({
		backlog: 100,
		deliveryQuery: (result) =>
			Effect.succeed(controls.merged().has(result.head) ? { head: result.head, revision: "merged", url: result.pr } : undefined),
		...controls.curve(),
	}));
}

export const repairAtPullRequestLimit = engineConfiguration("repair at pull request limit", () => ({
	concurrency: 3,
	denyDelivery: true,
	openPullRequests: { ease: 0, floor: 0, max: 1 },
	repairs: true,
}));

export const answerAtPullRequestLimit = engineConfiguration("answer at pull request limit", () => ({
	concurrency: 3,
	denyDelivery: true,
	openPullRequests: { ease: 0, floor: 0, max: 1 },
}));
