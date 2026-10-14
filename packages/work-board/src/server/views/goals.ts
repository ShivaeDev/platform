import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { openItem } from "#server/attention/inbox.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { type Item, itemsOf } from "./items.ts";

function countsOf(items: readonly Item[]): Readonly<Record<string, number>> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const status = item.document.parsed.fields.status ?? "not recorded";
		counts.set(status, (counts.get(status) ?? 0) + 1);
	}
	return Object.fromEntries(counts);
}

export function goals(snapshot: Snapshot): GoalsProjection {
	const items = itemsOf(snapshot);
	const claims = snapshot.documents.flatMap((document) => document.parsed.fields.evidence ?? []);
	const asks = snapshot.documents.flatMap((document) => document.parsed.fields.attention?.filter((ask) => ask.state === "open") ?? []);
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
					counts: countsOf(linked),
					criteria: (fields.criteria ?? []).map((criterion) => {
						const target = `${id}#${criterion.id}`;
						const work = linked.filter((item) =>
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
