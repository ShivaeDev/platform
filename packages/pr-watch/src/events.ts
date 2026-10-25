import type { Snapshot } from "#model.ts";

export const eventKinds = ["merged", "closed", "conflict", "queued", "dequeued", "auto-merge-off", "checks-failed", "stuck"] as const;
export type EventKind = (typeof eventKinds)[number];

function stuck(pr: Snapshot): boolean {
	return pr.state === "open" && pr.autoMerge && (pr.dirty || pr.failed);
}
function openEvents(before: Snapshot, after: Snapshot): readonly EventKind[] {
	const transitions: readonly (readonly [boolean, EventKind])[] = [
		[!before.dirty && after.dirty, "conflict"],
		[!before.queued && after.queued, "queued"],
		[before.queued && !after.queued, "dequeued"],
		[(before.autoMerge || before.queued) && !after.autoMerge && !after.queued, "auto-merge-off"],
		[!before.failed && after.failed, "checks-failed"],
		[!stuck(before) && stuck(after), "stuck"],
	];
	return transitions.flatMap(([changed, event]) => (changed ? [event] : []));
}
export function events(before: Snapshot | undefined, after: Snapshot, selected?: readonly EventKind[]): readonly string[] {
	if (before === undefined && !stuck(after)) {
		return [];
	}
	const baseline = before ?? { ...after, autoMerge: false, dirty: false, failed: false };
	const found: EventKind[] = [];
	if (!baseline.merged && after.merged) {
		found.push("merged");
	}
	if (baseline.state === "open" && after.state === "closed" && !after.merged) {
		found.push("closed");
	}
	if (after.state === "open") {
		found.push(...openEvents(baseline, after));
	}
	return found
		.filter((event) => selected === undefined || selected.includes(event))
		.map((event) => JSON.stringify({ branch: after.branch, event, number: after.number, title: after.title }));
}
