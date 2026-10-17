import type { Level } from "#config.ts";
import type { Finding } from "#rule.ts";

export type ActiveLevel = "error" | "warn";

export interface Violation extends Finding {
	readonly level: ActiveLevel;
	readonly rule: string;
}

export function keyOf(rule: string, file: string): string {
	return `${rule}\u0000${file}`;
}

export function byLocation(left: Violation, right: Violation): number {
	return left.rule.localeCompare(right.rule) || left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0);
}

export function groupBy<TItem>(items: readonly TItem[], key: (item: TItem) => string): ReadonlyMap<string, readonly TItem[]> {
	const groups = new Map<string, TItem[]>();
	for (const item of items) {
		const group = groups.get(key(item));
		if (group === undefined) {
			groups.set(key(item), [item]);
		} else {
			group.push(item);
		}
	}
	return groups;
}

export interface RuleIndex {
	readonly families: ReadonlySet<string>;
	readonly levels: ReadonlyMap<string, Level>;
	readonly unregistrable: ReadonlySet<string>;
}

export function covers(name: string, rule: string): boolean {
	return rule === name || rule.startsWith(`${name}/`);
}

function ownerOf(index: RuleIndex, rule: string): string {
	return [...index.families].find((family) => covers(family, rule)) ?? rule;
}

export function levelOf(index: RuleIndex, rule: string): Level | undefined {
	return index.levels.get(ownerOf(index, rule));
}

export function registrable(index: RuleIndex, rule: string): boolean {
	return !index.unregistrable.has(ownerOf(index, rule));
}

export function unusedEntryProblem(index: RuleIndex, rule: string, unused: string): string {
	const level = levelOf(index, rule);
	if (level === undefined) {
		return "names no known rule";
	}
	return level === "off" ? "names a rule that is off" : unused;
}
