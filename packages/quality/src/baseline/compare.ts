import type { BaselineEntry } from "#baseline/format.ts";
import { groupBy, halfSkipped, isSplit, keyOf, levelOf, type RuleIndex, skipped, unusedEntryProblem, type Violation } from "#engine/violation.ts";

export interface Regression {
	readonly allowed?: number;
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

export function countOf(violations: readonly Violation[]): number {
	return violations.reduce((total, violation) => total + (violation.count ?? 1), 0);
}

interface Allowance {
	readonly allowed: number;
	readonly exact: boolean;
	readonly share: string;
}

// Without its deep half, a run judges a split entry by the share it recorded for the fast half, or only as an upper bound when it recorded none.
function allowance(entry: BaselineEntry, rules: RuleIndex): Allowance {
	if (!halfSkipped(rules, entry.rule)) {
		return { allowed: entry.count, exact: true, share: "" };
	}
	return entry.deep === undefined
		? { allowed: entry.count, exact: false, share: "" }
		: { allowed: entry.count - entry.deep, exact: true, share: " for its fast half" };
}

type Verdict =
	| { readonly kind: "aside" }
	| { readonly kind: "covered"; readonly loose?: string }
	| { readonly kind: "regression"; readonly regression: Regression }
	| { readonly kind: "unused"; readonly problem: string };

function verdict(entry: BaselineEntry, group: readonly Violation[], rules: RuleIndex): Verdict {
	const { allowed, exact, share } = allowance(entry, rules);
	if (group.length === 0) {
		if (levelOf(rules, entry.rule) !== undefined && !(exact && allowed > 0)) {
			return { kind: "aside" };
		}
		const left = share === "" ? "has no violations left" : `has no violations left${share}: 0 against ${allowed} baselined`;
		return { kind: "unused", problem: unusedEntryProblem(rules, entry.rule, left) };
	}
	const count = countOf(group);
	if (count > allowed) {
		return { kind: "regression", regression: { ...(share === "" ? {} : { allowed }), count, entry } };
	}
	return count < allowed && exact
		? { kind: "covered", loose: `allows more than is left: ${count} against ${allowed} baselined${share}` }
		: { kind: "covered" };
}

export function applyBaseline(violations: readonly Violation[], entries: readonly BaselineEntry[], rules: RuleIndex): BaselineCheck {
	const groups = groupBy(violations, (violation) => keyOf(violation.rule, violation.file));
	const covered = new Set<string>();
	const regressions: Regression[] = [];
	const stale: StaleBaselineEntry[] = [];
	const loose: StaleBaselineEntry[] = [];
	for (const entry of entries.filter((candidate) => !skipped(rules, candidate.rule))) {
		const judged = verdict(entry, groups.get(keyOf(entry.rule, entry.file)) ?? [], rules);
		if (judged.kind === "unused") {
			(levelOf(rules, entry.rule) === undefined ? stale : loose).push({ entry, problem: judged.problem });
		} else if (judged.kind === "regression") {
			regressions.push(judged.regression);
		} else if (judged.kind === "covered") {
			covered.add(keyOf(entry.rule, entry.file));
			if (judged.loose !== undefined) {
				loose.push({ entry, problem: judged.loose });
			}
		}
	}
	const kept = violations.filter((violation) => !covered.has(keyOf(violation.rule, violation.file)));
	return { baselined: violations.length - kept.length, kept, loose, regressions, stale };
}

export function unsplitEntries(entries: readonly BaselineEntry[], rules: RuleIndex): readonly StaleBaselineEntry[] {
	return entries
		.filter((entry) => entry.deep === undefined && isSplit(rules, entry.rule) && !halfSkipped(rules, entry.rule))
		.map((entry) => ({ entry, problem: "does not record how many of its findings the deep half reports" }));
}
