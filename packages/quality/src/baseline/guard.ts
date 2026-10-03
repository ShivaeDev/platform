import { covers, groupBy, keyOf } from "../engine/violation.ts";
import type { BaselineEntry } from "./format.ts";

export type GuardProblem =
	| { readonly _tag: "Added"; readonly entry: BaselineEntry }
	| { readonly _tag: "Raised"; readonly entry: BaselineEntry; readonly base: BaselineEntry }
	| { readonly _tag: "Unadopted"; readonly rule: string; readonly entries: number }
	| { readonly _tag: "NothingAdopted"; readonly rule: string };

export interface GuardResult {
	readonly problems: ReadonlyArray<GuardProblem>;
	readonly moved: number;
	readonly adopted: ReadonlyArray<string>;
}

export const guardBaseline = (
	base: ReadonlyArray<BaselineEntry>,
	working: ReadonlyArray<BaselineEntry>,
	renames: ReadonlyMap<string, string>,
	adopt: ReadonlyArray<string>,
): GuardResult => {
	const before = new Map(base.map((entry) => [keyOf(entry.rule, entry.file), entry]));
	const covered = new Set(base.map((entry) => entry.rule));
	const byRule = groupBy(working, (entry) => entry.rule);
	const problems: GuardProblem[] = [];
	let moved = 0;
	for (const entry of working.filter((candidate) => covered.has(candidate.rule))) {
		const exact = before.get(keyOf(entry.rule, entry.file));
		const origin = renames.get(entry.file);
		const matched = exact ?? (origin === undefined ? undefined : before.get(keyOf(entry.rule, origin)));
		if (matched === undefined) {
			problems.push({ _tag: "Added", entry });
		} else if (entry.count > matched.count) {
			problems.push({ _tag: "Raised", base: matched, entry });
		} else if (exact === undefined) {
			moved += 1;
		}
	}
	const adopted = (rule: string): boolean => adopt.some((name) => covers(name, rule));
	const fresh = [...byRule.entries()].filter(([rule]) => !covered.has(rule));
	for (const [rule, entries] of fresh.filter(([rule]) => !adopted(rule))) {
		problems.push({ _tag: "Unadopted", entries: entries.length, rule });
	}
	for (const name of adopt.filter((candidate) => ![...byRule.keys()].some((rule) => covers(candidate, rule)))) {
		problems.push({ _tag: "NothingAdopted", rule: name });
	}
	return { adopted: fresh.map(([rule]) => rule).filter(adopted), moved, problems };
};
