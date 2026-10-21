import type { FleetItemsProjection } from "./FleetItemsProjection.ts";

export const pullRequestGroups = [
	"Ready to merge",
	"Reviewing",
	"Working",
	"Waiting on you",
	"Waiting on orchestrator",
	"Waiting on automation",
	"Queued",
] as const;
export type PullRequestGroup = (typeof pullRequestGroups)[number];
export type PullRequestItem = Extract<FleetItemsProjection, { state: "ready" }>["items"][number];

export function pullRequestGroup(item: PullRequestItem): PullRequestGroup {
	if (item.stage === "waiting") {
		if (item.attentionOwner === "maintainer" && item.readyToMerge) {
			return "Ready to merge";
		}
		if (item.attentionOwner === "maintainer") {
			return "Waiting on you";
		}
		return item.attentionOwner === "orchestrator" ? "Waiting on orchestrator" : "Waiting on automation";
	}
	if (item.stage === "reviewing") {
		return "Reviewing";
	}
	return item.stage === "working" ? "Working" : "Queued";
}

export function currentPullRequests(data: FleetItemsProjection | undefined): readonly PullRequestItem[] {
	return data?.state === "ready" ? data.items.filter((item) => item.prUrl && item.stage !== "done" && item.stage !== "released") : [];
}

export function readyToMergeCount(data: FleetItemsProjection | undefined): number | undefined {
	return data?.state === "ready" ? currentPullRequests(data).filter((item) => pullRequestGroup(item) === "Ready to merge").length : undefined;
}
