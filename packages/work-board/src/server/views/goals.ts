import type { GoalCounts, GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { inboxItems, openItem } from "#server/attention/inbox.ts";
import { deferredItem } from "#server/attention/status.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { type Item, itemsOf } from "./items.ts";

function countsOf(items: readonly Item[]): GoalCounts {
	const counts = { deferred: 0, done: 0, draft: 0, dropped: 0, ready: 0 };
	for (const item of items) {
		counts[item.document.parsed.fields.status ?? "draft"] += 1;
	}
	return counts;
}
function askTargets(ask: { readonly unblocks: readonly string[] }) {
	return ask.unblocks.map((target) => target.split("#")[0] ?? "");
}

export function goals(snapshot: Snapshot): GoalsProjection {
	const items = itemsOf(snapshot);
	const claims = snapshot.documents.flatMap((document) => document.parsed.fields.evidence ?? []);
	const asks = inboxItems(snapshot);
	const waiting = new Map(asks.flatMap((ask) => askTargets(ask).map((target) => [target, ask.reason] as const)));
	const projects = items.filter((item) => item.document.parsed.fields.kind === "goal").sort((a, b) => a.id.localeCompare(b.id));
	function toGoal({ id, title, document }: Item) {
		const fields = document.parsed.fields;
		const linked = items.filter((item) =>
			item.document.parsed.fields.relationships?.some(
				(link) => link.kind === "implements" && (link.target === id || link.target.startsWith(`${id}#`)),
			),
		);
		const lanes = linked.filter((item) => item.document.parsed.fields.kind === "goal");
		function laneTasks(goal: string) {
			return items.filter(
				(item) =>
					item.document.parsed.fields.kind === "task"
					&& item.document.parsed.fields.relationships?.some(
						(link) => link.kind === "implements" && (link.target === goal || link.target.startsWith(`${goal}#`)),
					),
			);
		}
		const tasks = [
			...new Map(
				[...linked.filter((item) => item.document.parsed.fields.kind === "task"), ...lanes.flatMap((lane) => laneTasks(lane.id))].map((item) => [
					item.id,
					item,
				]),
			).values(),
		];
		const unblocks = new Set([id, ...linked.map((item) => item.id)]);
		const open = asks.filter((ask) => askTargets(ask).some((target) => unblocks.has(target)));
		return {
			asks: open.map((ask) => ({ href: ask.href, id: ask.id, reason: ask.reason, title: ask.title })),
			counts: countsOf(tasks),
			criteria: (fields.criteria ?? []).map((criterion) => {
				const target = `${id}#${criterion.id}`;
				const work = tasks.filter((item) =>
					item.document.parsed.fields.relationships?.some((link) => link.kind === "implements" && link.target === target),
				);
				return {
					...criterion,
					counts: countsOf(work),
					evidence: claims.filter((claim) => claim.criterion === target).length,
					linked: work.length,
				};
			}),
			id,
			lanes: lanes.map((lane) => ({ counts: countsOf(laneTasks(lane.id)), id: lane.id, title: lane.title })),
			linked: tasks.length,
			nextAction: fields.nextAction,
			openAsks: open.length,
			owner: fields.owner,
			status: fields.status,
			title,
			unlinked: tasks.length === 0,
		};
	}
	return {
		closedGoals: projects.filter((item) => !openItem(item.document)).map(toGoal),
		deferredGoals: projects.filter((item) => deferredItem(item.document)).map(toGoal),
		goals: projects.filter((item) => openItem(item.document) && !deferredItem(item.document)).map(toGoal),
		items: items
			.filter(
				(item) =>
					["task", "goal"].includes(item.document.parsed.fields.kind ?? "")
					&& item.document.parsed.fields.relationships?.some((link) => link.kind === "implements"),
			)
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
