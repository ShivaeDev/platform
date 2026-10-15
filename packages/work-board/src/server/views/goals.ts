import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { goalWorkGroup } from "#browser/views/goalWorkState.ts";
import { inboxItems, openItem } from "#server/attention/inbox.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { type Item, itemsOf } from "./items.ts";

function countsOf(items: readonly Item[], fleet: FleetItemsProjection | undefined) {
	const counts = { done: 0, "in progress": 0, planned: 0 };
	const runs = fleet?.state === "ready" ? [...fleet.items, ...fleet.completed] : [];
	for (const item of items) {
		const group = goalWorkGroup(item.document.parsed.fields.status, runs.find((run) => run.workId === item.id)?.stage);
		const status = { Deferred: "planned", Done: "done", "In progress": "in progress", Planned: "planned" } as const;
		counts[status[group]] += 1;
	}
	return counts;
}

export function goals(snapshot: Snapshot, fleet?: FleetItemsProjection): GoalsProjection {
	const items = itemsOf(snapshot);
	const claims = snapshot.documents.flatMap((document) => document.parsed.fields.evidence ?? []);
	const asks = inboxItems(snapshot);
	return {
		goals: items
			.filter((item) => item.document.parsed.fields.kind === "project" && openItem(item.document))
			.sort((a, b) => a.id.localeCompare(b.id))
			.map(({ id, title, document }) => {
				const fields = document.parsed.fields;
				const linked = items.filter((item) =>
					item.document.parsed.fields.relationships?.some(
						(link) => link.kind === "implements" && (link.target === id || link.target.startsWith(`${id}#`)),
					),
				);
				const unblocks = new Set([id, ...linked.map((item) => item.id)]);
				return {
					counts: countsOf(linked, fleet),
					criteria: (fields.criteria ?? []).map((criterion) => {
						const target = `${id}#${criterion.id}`;
						const work = linked.filter((item) =>
							item.document.parsed.fields.relationships?.some((link) => link.kind === "implements" && link.target === target),
						);
						return {
							...criterion,
							counts: countsOf(work, fleet),
							evidence: claims.filter((claim) => claim.criterion === target).length,
							linked: work.length,
						};
					}),
					id,
					linked: linked.length,
					nextAction: fields.nextAction,
					openAsks: asks.filter((ask) => ask.unblocks.some((target) => unblocks.has(target.split("#")[0] ?? ""))).length,
					owner: fields.owner,
					status: fields.status,
					title,
					unlinked: linked.length === 0,
				};
			}),
	};
}
