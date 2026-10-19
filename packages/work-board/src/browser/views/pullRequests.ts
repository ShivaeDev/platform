import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

export const pullRequestGroups = ["Ready to merge", "Checks running", "Being repaired", "Needs a human answer", "In progress"] as const;
export type PullRequestGroup = (typeof pullRequestGroups)[number];
export type PullRequestItem = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];

export function pullRequestGroup(item: PullRequestItem): PullRequestGroup {
	if (item.stage === "needs-human") {
		return item.attentionOwner === "maintainer" && item.readyToMerge ? "Ready to merge" : "Needs a human answer";
	}
	if (item.stage === "validating") {
		return "Checks running";
	}
	return item.stage === "repairing" ? "Being repaired" : "In progress";
}

export function currentPullRequests(data: FleetItemsProjection | undefined): readonly PullRequestItem[] {
	return data?.state === "ready" ? data.items.filter((item) => item.prUrl && item.stage !== "completed" && item.stage !== "released") : [];
}

export function readyToMergeCount(data: FleetItemsProjection | undefined): number | undefined {
	return data?.state === "ready" ? currentPullRequests(data).filter((item) => pullRequestGroup(item) === "Ready to merge").length : undefined;
}
