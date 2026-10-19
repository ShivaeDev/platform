import { matchOrder } from "#browser/search/nameMatch.ts";
import type { SearchItem } from "./searchCommands.ts";

const GROUPS = ["Needs you", "Go to", "Appearance", "Work", "Documents"] as const;

function groupOf(item: SearchItem): (typeof GROUPS)[number] {
	if (item.kind === "needs-you") {
		return "Needs you";
	}
	if (item.kind === "command") {
		return item.command ? "Appearance" : "Go to";
	}
	return item.itemKind ? "Work" : "Documents";
}

function matchRank(item: SearchItem): number {
	return matchOrder(item.match ?? "title");
}

function nameFirst(item: SearchItem): number {
	return Math.min(matchRank(item), matchOrder("title"));
}

function bestRank(items: readonly SearchItem[]): number {
	return Math.min(...items.map(matchRank));
}

export function searchGroups(items: readonly SearchItem[], query: string) {
	const groups = GROUPS.map((heading) => ({ heading, items: items.filter((item) => groupOf(item) === heading) }));
	if (!query.trim()) {
		return groups;
	}
	return groups
		.map((group) => ({ ...group, items: group.items.toSorted((left, right) => nameFirst(left) - nameFirst(right)) }))
		.toSorted((left, right) => bestRank(left.items) - bestRank(right.items));
}
