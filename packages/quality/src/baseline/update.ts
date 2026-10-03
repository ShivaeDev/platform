import type { Level } from "../config.ts";
import { groupBy, keyOf, type Violation } from "../engine/violation.ts";
import { countOf } from "./compare.ts";
import type { BaselineEntry } from "./format.ts";

export type Adoption =
	| { readonly _tag: "Refused"; readonly reasons: ReadonlyArray<string> }
	| { readonly _tag: "Adopted"; readonly entries: ReadonlyArray<BaselineEntry>; readonly added: number; readonly replaced: number };

export interface Pruned {
	readonly entries: ReadonlyArray<BaselineEntry>;
	readonly moved: number;
	readonly removed: number;
	readonly lowered: number;
}

const record = (violations: ReadonlyArray<Violation>): ReadonlyArray<BaselineEntry> =>
	[...groupBy(violations, (violation) => keyOf(violation.rule, violation.file)).values()].flatMap((group) => {
		const first = group[0];
		if (first === undefined) {
			return [];
		}
		const count = countOf(group);
		return count > 0 ? [{ count, file: first.file, rule: first.rule }] : [];
	});

const refusal = (id: string, levels: ReadonlyMap<string, Level>): ReadonlyArray<string> => {
	const level = levels.get(id);
	if (level === undefined) {
		return [`${id}: no built-in or local rule has this id.`];
	}
	return level === "error" ? [] : [`${id}: the rule is ${level}. Set it to error before baselining it.`];
};

export const adopt = (
	existing: ReadonlyArray<BaselineEntry> | undefined,
	rules: ReadonlyArray<string>,
	violations: ReadonlyArray<Violation>,
	levels: ReadonlyMap<string, Level>,
): Adoption => {
	if (existing !== undefined && rules.length === 0) {
		return { _tag: "Refused", reasons: ["a baseline exists. Record a rule with --rule <id>, or drop fixed debt with prune."] };
	}
	const reasons = rules.flatMap((id) => refusal(id, levels));
	if (reasons.length > 0) {
		return { _tag: "Refused", reasons };
	}
	const kept = (existing ?? []).filter((entry) => !rules.includes(entry.rule));
	const adopted = violations.filter((violation) => violation.level === "error" && (rules.length === 0 || rules.includes(violation.rule)));
	const added = record(adopted);
	return { _tag: "Adopted", added: added.length, entries: [...kept, ...added], replaced: (existing ?? []).length - kept.length };
};

export interface Scope {
	readonly moves: ReadonlyMap<string, string>;
	readonly files?: ReadonlySet<string> | undefined;
}

const inScope = (entry: BaselineEntry, scope: Scope): boolean =>
	scope.files === undefined || scope.files.has(entry.file) || scope.moves.has(entry.file);

const destination = (
	before: BaselineEntry,
	current: ReadonlyMap<string, BaselineEntry>,
	moves: ReadonlyMap<string, string>,
	taken: ReadonlySet<string>,
) => {
	const to = moves.get(before.file);
	const key = to === undefined ? undefined : keyOf(before.rule, to);
	return key === undefined || taken.has(key) ? undefined : current.get(key);
};

export const prune = (
	existing: ReadonlyArray<BaselineEntry>,
	violations: ReadonlyArray<Violation>,
	levels: ReadonlyMap<string, Level>,
	scope: Scope = { moves: new Map() },
): Pruned => {
	const current = new Map(record(violations).map((entry) => [keyOf(entry.rule, entry.file), entry]));
	const taken = new Set(existing.map((entry) => keyOf(entry.rule, entry.file)));
	let moved = 0;
	const kept = existing.flatMap((before) => {
		if (!inScope(before, scope)) {
			return [{ after: before, before }];
		}
		const level = levels.get(before.rule);
		const now = current.get(keyOf(before.rule, before.file)) ?? destination(before, current, scope.moves, taken);
		if (now === undefined || level === undefined || level === "off") {
			return [];
		}
		moved += Number(now.file !== before.file);
		return [{ after: { count: Math.min(before.count, now.count), file: now.file, rule: before.rule }, before }];
	});
	return {
		entries: kept.map(({ after }) => after),
		lowered: kept.filter(({ after, before }) => after.count !== before.count).length,
		moved,
		removed: existing.length - kept.length,
	};
};
