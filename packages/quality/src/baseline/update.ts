import { countOf } from "#baseline/compare.ts";
import type { BaselineEntry } from "#baseline/format.ts";
import { covers, groupBy, isSplit, keyOf, levelOf, type RuleIndex, type Violation } from "#engine/violation.ts";

export type Adoption =
	| { readonly _tag: "Refused"; readonly reasons: readonly string[] }
	| { readonly _tag: "Adopted"; readonly entries: readonly BaselineEntry[]; readonly added: number; readonly replaced: number };

export interface Pruned {
	readonly entries: readonly BaselineEntry[];
	readonly lowered: number;
	readonly moved: number;
	readonly removed: number;
	readonly split: number;
}

function record(violations: readonly Violation[], index: RuleIndex): readonly BaselineEntry[] {
	return [...groupBy(violations, (violation) => keyOf(violation.rule, violation.file)).values()].flatMap((group) => {
		const first = group[0];
		if (first === undefined) {
			return [];
		}
		const count = countOf(group);
		const deep = isSplit(index, first.rule) ? { deep: countOf(group.filter((violation) => violation.deep === true)) } : {};
		return count > 0 ? [{ count, ...deep, file: first.file, rule: first.rule }] : [];
	});
}

// Each half only ever lowers its own share, so a split entry keeps the smaller fast share and the smaller deep share.
function lowered(before: BaselineEntry, now: BaselineEntry): BaselineEntry | undefined {
	const { deep: _recorded, ...kept } = before;
	if (now.deep === undefined) {
		return { ...kept, count: Math.min(before.count, now.count), file: now.file };
	}
	if (before.deep === undefined) {
		return now.count > before.count ? { ...kept, file: now.file } : { ...kept, count: now.count, deep: now.deep, file: now.file };
	}
	const deep = Math.min(before.deep, now.deep);
	const count = Math.min(before.count - before.deep, now.count - now.deep) + deep;
	return count === 0 ? undefined : { ...kept, count, deep, file: now.file };
}

function refusal(id: string, index: RuleIndex): readonly string[] {
	const level = levelOf(index, id);
	if (level === undefined) {
		return [`${id}: no built-in or local rule has this id.`];
	}
	return [];
}

export function adopt(
	existing: readonly BaselineEntry[] | undefined,
	rules: readonly string[],
	violations: readonly Violation[],
	index: RuleIndex,
): Adoption {
	const reasons = rules.flatMap((id) => refusal(id, index));
	if (reasons.length > 0) {
		return { _tag: "Refused", reasons };
	}
	function named(rule: string): boolean {
		return rules.length === 0 || rules.some((name) => covers(name, rule));
	}
	const kept = (existing ?? []).filter((entry) => !named(entry.rule));
	const adopted = violations.filter((violation) => named(violation.rule));
	const added = record(adopted, index);
	return { _tag: "Adopted", added: added.length, entries: [...kept, ...added], replaced: (existing ?? []).length - kept.length };
}

export interface Scope {
	readonly files?: ReadonlySet<string> | undefined;
	readonly moves: ReadonlyMap<string, string>;
}

function inScope(entry: BaselineEntry, scope: Scope): boolean {
	return scope.files === undefined || scope.files.has(entry.file) || scope.moves.has(entry.file);
}

function destination(
	before: BaselineEntry,
	current: ReadonlyMap<string, BaselineEntry>,
	moves: ReadonlyMap<string, string>,
	taken: ReadonlySet<string>,
) {
	const to = moves.get(before.file);
	const key = to === undefined ? undefined : keyOf(before.rule, to);
	return key === undefined || taken.has(key) ? undefined : current.get(key);
}

export function prune(
	existing: readonly BaselineEntry[],
	violations: readonly Violation[],
	index: RuleIndex,
	scope: Scope = { moves: new Map() },
): Pruned {
	const current = new Map(record(violations, index).map((entry) => [keyOf(entry.rule, entry.file), entry]));
	const taken = new Set(existing.map((entry) => keyOf(entry.rule, entry.file)));
	let moved = 0;
	const kept = existing.flatMap((before) => {
		if (!inScope(before, scope)) {
			return [{ after: before, before }];
		}
		const level = levelOf(index, before.rule);
		const now = current.get(keyOf(before.rule, before.file)) ?? destination(before, current, scope.moves, taken);
		const after = now === undefined || level === undefined ? undefined : lowered(before, now);
		if (after === undefined) {
			return [];
		}
		moved += Number(after.file !== before.file);
		return [{ after, before }];
	});
	return {
		entries: kept.map(({ after }) => after),
		lowered: kept.filter(({ after, before }) => after.count !== before.count).length,
		moved,
		removed: existing.length - kept.length,
		split: kept.filter(({ after, before }) => after.count === before.count && after.deep !== before.deep).length,
	};
}
