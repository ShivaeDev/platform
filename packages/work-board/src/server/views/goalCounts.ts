import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import type { Item } from "./items.ts";

export function goalCounts(snapshot: Snapshot, fleet?: FleetItemsProjection) {
	const runs = new Map(fleet?.state === "ready" ? [...fleet.completed, ...fleet.items].map((run) => [run.workId, run]) : []);
	const waiting = new Set(inboxItems(snapshot).flatMap((ask) => ask.unblocks.map((target) => target.split("#")[0])));
	function state(item: Item): keyof GoalCounts {
		const fields = item.document.parsed.fields;
		const run = runs.get(item.id);
		if (fields.status === "done") {
			return "done";
		}
		if (waiting.has(item.id) || run?.stage === "waiting") {
			return "blocked";
		}
		if (run?.stage === "working" || run?.stage === "reviewing") {
			return "running";
		}
		if (run?.stage === "done") {
			return "done";
		}
		if (fields.status === "deferred" || fields.fleet === "held" || fields.fleet === "manual") {
			return "parked";
		}
		return fields.fleet === "approved" ? "scheduled" : "parked";
	}
	return (items: readonly Item[]): GoalCounts => {
		const counts = { blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 };
		for (const item of items) {
			if (item.document.parsed.fields.status !== "dropped") {
				counts[state(item)] += 1;
			}
		}
		return counts;
	};
}
