import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { GoalCounts, GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { goalWorkGroup } from "#browser/views/goalWorkState.ts";
import { inboxItems, openItem } from "#server/attention/inbox.ts";
import { deferredItem } from "#server/attention/status.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { type Item, itemsOf } from "./items.ts";

const countOf = { Done: "done", "In progress": "in progress", "Needs you": "needs you", Planned: "planned" } as const;
function countsOf(items: readonly Item[], fleet: FleetItemsProjection | undefined, waiting: ReadonlyMap<string, string>) {
	const counts: { -readonly [TKey in keyof GoalCounts]: number } = { done: 0, "in progress": 0, "needs you": 0, planned: 0 };
	const runs = fleet?.state === "ready" ? [...fleet.items, ...fleet.completed] : [];
	for (const item of items) {
		const group = goalWorkGroup(item.document.parsed.fields.status, runs.find((run) => run.workId === item.id)?.stage, waiting.has(item.id));
		counts[countOf[group]] += 1;
	}
	return counts;
}
function askTargets(ask: { readonly unblocks: readonly string[] }) {
	return ask.unblocks.map((target) => target.split("#")[0] ?? "");
}

export function goals(snapshot: Snapshot, fleet?: FleetItemsProjection): GoalsProjection {
	const items = itemsOf(snapshot);
	const claims = snapshot.documents.flatMap((document) => document.parsed.fields.evidence ?? []);
	const asks = inboxItems(snapshot);
	const waiting = new Map(asks.flatMap((ask) => askTargets(ask).map((target) => [target, ask.reason] as const)));
	const projects = items.filter((item) => item.document.parsed.fields.kind === "project").sort((a, b) => a.id.localeCompare(b.id));
	function toGoal({ id, title, document }: Item) {
		const fields = document.parsed.fields;
		const linked = items.filter((item) =>
			item.document.parsed.fields.relationships?.some(
				(link) => link.kind === "implements" && (link.target === id || link.target.startsWith(`${id}#`)),
			),
		);
		const unblocks = new Set([id, ...linked.map((item) => item.id)]);
		const open = asks.filter((ask) => askTargets(ask).some((target) => unblocks.has(target)));
		return {
			asks: open.map((ask) => ({ href: ask.href, id: ask.id, reason: ask.reason, title: ask.title })),
			counts: countsOf(linked, fleet, waiting),
			criteria: (fields.criteria ?? []).map((criterion) => {
				const target = `${id}#${criterion.id}`;
				const work = linked.filter((item) =>
					item.document.parsed.fields.relationships?.some((link) => link.kind === "implements" && link.target === target),
				);
				return {
					...criterion,
					counts: countsOf(work, fleet, waiting),
					evidence: claims.filter((claim) => claim.criterion === target).length,
					linked: work.length,
				};
			}),
			id,
			linked: linked.length,
			nextAction: fields.nextAction,
			openAsks: open.length,
			owner: fields.owner,
			status: fields.status,
			title,
			unlinked: linked.length === 0,
		};
	}
	return {
		closedGoals: projects.filter((item) => !openItem(item.document)).map(toGoal),
		deferredGoals: projects.filter((item) => deferredItem(item.document)).map(toGoal),
		goals: projects.filter((item) => openItem(item.document) && !deferredItem(item.document)).map(toGoal),
		items: items
			.filter((item) => item.document.parsed.fields.relationships?.some((link) => link.kind === "implements"))
			.map(({ document, id, title }) => ({
				file: document.file,
				id,
				metadata: document.parsed.fields,
				modified: snapshot.modified.get(document.file),
				title,
				waiting: waiting.get(id),
			})),
	};
}
