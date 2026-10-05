import type { MetadataDocument } from "#metadata/model.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { fieldFilter, type State } from "./state.ts";

export interface Item {
	readonly document: MetadataDocument;
	readonly id: string;
	readonly title: string;
}
export function itemsOf(snapshot: Snapshot): readonly Item[] {
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	return [...snapshot.model.ids].flatMap(([id, documents]) => {
		const document = documents.length === 1 ? documents[0] : undefined;
		return document ? [{ document, id, title: titles.get(document.file) ?? document.file }] : [];
	});
}
function matches(item: Item, state: State): boolean {
	const fields = item.document.parsed.fields;
	if (state.owner && fieldFilter(fields.owner) !== state.owner) {
		return false;
	}
	if (state.status && fieldFilter(fields.status) !== state.status) {
		return false;
	}
	const text = [item.id, item.title, fields.kind, fields.status, fields.owner, fields.nextAction]
		.filter(Boolean)
		.join(" ")
		.normalize("NFKC")
		.toLowerCase();
	return state.query
		.normalize("NFKC")
		.toLowerCase()
		.split(/\s+/u)
		.filter(Boolean)
		.every((term) => text.includes(term));
}
function order(item: Item, sort: State["sort"]): string | undefined {
	return sort === "title" ? item.title : item.document.parsed.fields[sort];
}
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function filterItems(items: readonly Item[], state: State): readonly Item[] {
	return items
		.filter((item) => matches(item, state))
		.sort((a, b) => {
			const left = order(a, state.sort);
			const right = order(b, state.sort);
			if (left === undefined) {
				return right === undefined ? a.id.localeCompare(b.id) : 1;
			}
			if (right === undefined) {
				return -1;
			}
			return collator.compare(left, right) || a.id.localeCompare(b.id);
		});
}
