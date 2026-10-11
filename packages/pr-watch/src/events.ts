import type { Snapshot } from "./model.ts";

function stuck(pr: Snapshot): boolean {
	return pr.state === "open" && pr.autoMerge && (pr.dirty || pr.failed);
}
function openEvents(before: Snapshot, after: Snapshot): readonly string[] {
	const transitions: readonly (readonly [boolean, string])[] = [
		[!before.dirty && after.dirty, "conflict"],
		[before.queued && !after.queued, "dequeued"],
		[before.autoMerge && !after.autoMerge, "auto-merge-off"],
		[!before.failed && after.failed, "checks-failed"],
		[!stuck(before) && stuck(after), "stuck"],
	];
	return transitions.flatMap(([changed, event]) => (changed ? [event] : []));
}
export function events(before: Snapshot | undefined, after: Snapshot): readonly string[] {
	if (before === undefined) {
		return [];
	}
	const found: string[] = [];
	if (!before.merged && after.merged) {
		found.push("merged");
	}
	if (before.state === "open" && after.state === "closed" && !after.merged) {
		found.push("closed");
	}
	if (after.state === "open") {
		found.push(...openEvents(before, after));
	}
	return found.map((event) => JSON.stringify({ branch: after.branch, event, number: after.number, title: after.title }));
}
