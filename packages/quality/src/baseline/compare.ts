import type { Level } from "../config.ts";
import { groupBy, keyOf, unusedEntryProblem, type Violation } from "../engine/violation.ts";
import type { BaselineEntry } from "./format.ts";

export interface Tally {
	readonly count: number;
	readonly measure: number | undefined;
}

export interface Regression {
	readonly entry: BaselineEntry;
	readonly tally: Tally;
}

export interface StaleBaselineEntry {
	readonly entry: BaselineEntry;
	readonly problem: string;
}

export interface BaselineCheck {
	readonly kept: ReadonlyArray<Violation>;
	readonly regressions: ReadonlyArray<Regression>;
	readonly stale: ReadonlyArray<StaleBaselineEntry>;
	readonly baselined: number;
}

type Verdict = { readonly _tag: "Covered"; readonly loose: boolean } | { readonly _tag: "Regressed" };

const measures = (violations: ReadonlyArray<Violation>): ReadonlyArray<number> =>
	violations.flatMap((violation) => (violation.measure === undefined ? [] : [violation.measure]));

export const tallyOf = (violations: ReadonlyArray<Violation>): Tally => {
	const found = measures(violations);
	return { count: violations.length, measure: found.length === 0 ? undefined : Math.max(...found) };
};

const measureTrend = (entry: BaselineEntry, tally: Tally): number =>
	entry.measure === undefined || tally.measure === undefined ? 0 : Math.sign(tally.measure - entry.measure);

const verdictOf = (entry: BaselineEntry, tally: Tally): Verdict => {
	const trend = measureTrend(entry, tally);
	if (tally.count > entry.count || trend > 0) {
		return { _tag: "Regressed" };
	}
	return { _tag: "Covered", loose: tally.count < entry.count || trend < 0 };
};

export const describeTally = (tally: Tally): string =>
	`${tally.count} violation${tally.count === 1 ? "" : "s"}${tally.measure === undefined ? "" : ` measuring ${tally.measure}`}`;

export const describeEntry = (entry: BaselineEntry): string => describeTally({ count: entry.count, measure: entry.measure });

export const applyBaseline = (
	violations: ReadonlyArray<Violation>,
	entries: ReadonlyArray<BaselineEntry>,
	levels: ReadonlyMap<string, Level>,
): BaselineCheck => {
	const groups = groupBy(violations, (violation) => keyOf(violation.rule, violation.file));
	const covered = new Set<string>();
	const regressions: Regression[] = [];
	const stale: StaleBaselineEntry[] = [];
	for (const entry of entries) {
		const group = groups.get(keyOf(entry.rule, entry.file)) ?? [];
		if (group.length === 0) {
			stale.push({ entry, problem: unusedEntryProblem(levels, entry.rule, "has no violations left") });
			continue;
		}
		const tally = tallyOf(group);
		const verdict = verdictOf(entry, tally);
		if (verdict._tag === "Regressed") {
			regressions.push({ entry, tally });
			continue;
		}
		covered.add(keyOf(entry.rule, entry.file));
		if (verdict.loose) {
			stale.push({ entry, problem: `allows more than is left: ${describeTally(tally)} against ${describeEntry(entry)} baselined` });
		}
	}
	const kept = violations.filter((violation) => !covered.has(keyOf(violation.rule, violation.file)));
	return { baselined: violations.length - kept.length, kept, regressions, stale };
};
