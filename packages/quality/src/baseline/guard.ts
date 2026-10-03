import { groupBy, keyOf } from "../engine/violation.ts";
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

const raises = (base: BaselineEntry, entry: BaselineEntry): boolean =>
	entry.count > base.count || (base.measure !== undefined && (entry.measure === undefined || entry.measure > base.measure));

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
		} else if (raises(matched, entry)) {
			problems.push({ _tag: "Raised", base: matched, entry });
		} else if (exact === undefined) {
			moved += 1;
		}
	}
	const fresh = [...byRule.entries()].filter(([rule]) => !covered.has(rule));
	for (const [rule, entries] of fresh.filter(([rule]) => !adopt.includes(rule))) {
		problems.push({ _tag: "Unadopted", entries: entries.length, rule });
	}
	for (const rule of adopt.filter((candidate) => !byRule.has(candidate))) {
		problems.push({ _tag: "NothingAdopted", rule });
	}
	return { adopted: fresh.map(([rule]) => rule).filter((rule) => adopt.includes(rule)), moved, problems };
};
