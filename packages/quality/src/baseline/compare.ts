import { groupBy, keyOf, levelOf, type RuleIndex, unusedEntryProblem, type Violation } from "../engine/violation.ts";
import type { BaselineEntry } from "./format.ts";

export interface Regression {
	readonly count: number;
	readonly entry: BaselineEntry;
}

export interface StaleBaselineEntry {
	readonly entry: BaselineEntry;
	readonly problem: string;
}

export interface BaselineCheck {
	readonly baselined: number;
	readonly kept: readonly Violation[];
	readonly loose: readonly StaleBaselineEntry[];
	readonly regressions: readonly Regression[];
	readonly stale: readonly StaleBaselineEntry[];
}

export const countOf = (violations: readonly Violation[]): number => violations.reduce((total, violation) => total + (violation.count ?? 1), 0);

export const applyBaseline = (violations: readonly Violation[], entries: readonly BaselineEntry[], rules: RuleIndex): BaselineCheck => {
	const groups = groupBy(violations, (violation) => keyOf(violation.rule, violation.file));
	const covered = new Set<string>();
	const regressions: Regression[] = [];
	const stale: StaleBaselineEntry[] = [];
	const loose: StaleBaselineEntry[] = [];
	for (const entry of entries) {
		const group = groups.get(keyOf(entry.rule, entry.file)) ?? [];
		if (group.length === 0) {
			const level = levelOf(rules, entry.rule);
			(level === undefined || level === "off" ? stale : loose).push({
				entry,
				problem: unusedEntryProblem(rules, entry.rule, "has no violations left"),
			});
			continue;
		}
		const count = countOf(group);
		if (count > entry.count) {
			regressions.push({ count, entry });
			continue;
		}
		covered.add(keyOf(entry.rule, entry.file));
		if (count < entry.count) {
			loose.push({ entry, problem: `allows more than is left: ${count} against ${entry.count} baselined` });
		}
	}
	const kept = violations.filter((violation) => !covered.has(keyOf(violation.rule, violation.file)));
	return { baselined: violations.length - kept.length, kept, loose, regressions, stale };
};
