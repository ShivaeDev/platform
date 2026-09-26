import type { Level } from "../config.ts";
import type { Finding } from "../rule.ts";

export type ActiveLevel = "error" | "warn";

export interface Violation extends Finding {
	readonly rule: string;
	readonly level: ActiveLevel;
}

export const keyOf = (rule: string, file: string): string => `${rule}\u0000${file}`;

export const byLocation = (left: Violation, right: Violation): number =>
	left.rule.localeCompare(right.rule) || left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0);

export const groupBy = <Item>(items: ReadonlyArray<Item>, key: (item: Item) => string): ReadonlyMap<string, ReadonlyArray<Item>> => {
	const groups = new Map<string, Item[]>();
	for (const item of items) {
		const group = groups.get(key(item));
		if (group === undefined) {
			groups.set(key(item), [item]);
		} else {
			group.push(item);
		}
	}
	return groups;
};

export const unusedEntryProblem = (levels: ReadonlyMap<string, Level>, rule: string, unused: string): string => {
	const level = levels.get(rule);
	if (level === undefined) {
		return "names no known rule";
	}
	return level === "off" ? "names a rule that is off" : unused;
};
