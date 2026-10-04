import type { Level } from "#config.ts";
import type { Finding } from "#rule.ts";

export type ActiveLevel = "error" | "warn";

export interface Violation extends Finding {
	readonly level: ActiveLevel;
	readonly rule: string;
}

export const keyOf = (rule: string, file: string): string => `${rule}\u0000${file}`;

export const byLocation = (left: Violation, right: Violation): number =>
	left.rule.localeCompare(right.rule) || left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0);

export const groupBy = <Item>(items: readonly Item[], key: (item: Item) => string): ReadonlyMap<string, readonly Item[]> => {
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

export interface RuleIndex {
	readonly families: ReadonlySet<string>;
	readonly levels: ReadonlyMap<string, Level>;
	readonly unregistrable: ReadonlySet<string>;
}

export const covers = (name: string, rule: string): boolean => rule === name || rule.startsWith(`${name}/`);

const ownerOf = (index: RuleIndex, rule: string): string => [...index.families].find((family) => covers(family, rule)) ?? rule;

export const levelOf = (index: RuleIndex, rule: string): Level | undefined => index.levels.get(ownerOf(index, rule));

export const registrable = (index: RuleIndex, rule: string): boolean => !index.unregistrable.has(ownerOf(index, rule));

export const unusedEntryProblem = (index: RuleIndex, rule: string, unused: string): string => {
	const level = levelOf(index, rule);
	if (level === undefined) {
		return "names no known rule";
	}
	return level === "off" ? "names a rule that is off" : unused;
};
