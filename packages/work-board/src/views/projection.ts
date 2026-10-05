import type { Snapshot } from "#search/snapshot.ts";
import { filterItems, type Item, itemsOf } from "./items.ts";
import type { State } from "./state.ts";

export interface Projection {
	readonly boards: readonly Item[];
	readonly issues: readonly string[];
	readonly items: readonly Item[];
	readonly rows: readonly Item[];
	readonly selected: Item | undefined;
	readonly selectedOutside: boolean;
	readonly title: string;
	readonly validBoard: boolean;
}
function boardItems(board: Item, items: readonly Item[], snapshot: Snapshot) {
	const references = board.document.parsed.fields.items ?? [];
	const byId = new Map(items.map((item) => [item.id, item]));
	const issues: string[] = [];
	const found: Item[] = [];
	for (const id of new Set(references)) {
		const item = byId.get(id);
		if (item) {
			found.push(item);
		} else {
			issues.push(`${id}: ${(snapshot.model.ids.get(id)?.length ?? 0) > 1 ? "ambiguous ID" : "missing or invalid ID"}`);
		}
		if (references.filter((reference) => reference === id).length > 1) {
			issues.push(`${id}: repeated membership, shown once`);
		}
	}
	return { found, issues };
}
export function projectItems(snapshot: Snapshot, state: State): Projection {
	const known = itemsOf(snapshot);
	const boards = known.filter((item) => item.document.parsed.fields.kind === "board");
	const board = boards.find((item) => item.id === state.board);
	const membership = board ? boardItems(board, known, snapshot) : undefined;
	const items = membership?.found ?? known.filter((item) => item.document.parsed.fields.kind !== "board");
	const rows = filterItems(items, state);
	const selected = known.find((item) => item.id === state.item);
	const issues =
		membership?.issues
		?? [...snapshot.model.ids]
			.filter(([, documents]) => documents.length > 1)
			.map(([id]) => `${id}: ambiguous ID; open its source files to correct the declaration`);
	const sourceIssues = board
		? (snapshot.model.diagnostics.get(board.document.file) ?? []).map((problem) => `${board.document.file}:${problem.line}: ${problem.message}`)
		: [];
	return {
		boards,
		issues: [...issues, ...sourceIssues],
		items,
		rows,
		selected,
		selectedOutside: selected !== undefined && !rows.some((item) => item.id === selected.id),
		title: board?.title ?? "All work",
		validBoard: !state.board || board !== undefined,
	};
}
