import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";
import { type RuleIndex, registrable, unusedEntryProblem, type Violation } from "../engine/violation.ts";

const RegistryEntry = Schema.Struct({
	file: Schema.NonEmptyString,
	reason: Schema.String.check(Schema.isPattern(/\S/u, { expected: "a reason that says why the exception is permanent" })),
	rule: Schema.NonEmptyString,
	subject: Schema.optionalKey(Schema.NonEmptyString),
});

export type RegistryEntry = typeof RegistryEntry.Type;

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(Schema.Array(RegistryEntry)), {
	parseOptions: { errors: "all", onExcessProperty: "error" },
});

export const decodeRegistry = (raw: string | undefined): Promise<Decoded<readonly RegistryEntry[]>> =>
	raw === undefined ? Promise.resolve({ _tag: "Valid", value: [] }) : decodeWith(standard, raw);

export interface StaleRegistryEntry {
	readonly entry: RegistryEntry;
	readonly problem: string;
}

export interface RegistryCheck {
	readonly kept: readonly Violation[];
	readonly registered: number;
	readonly stale: readonly StaleRegistryEntry[];
}

const covers = (entry: RegistryEntry, violation: Violation): boolean =>
	entry.rule === violation.rule && entry.file === violation.file && (entry.subject === undefined || entry.subject === violation.subject);

const UNREGISTRABLE = "names a rule that takes no exceptions. Fix the code, or baseline the violations while the repository adopts the rule";

const coveringEntry = (entries: readonly RegistryEntry[], violation: Violation): RegistryEntry | undefined => {
	const matching = entries.filter((entry) => covers(entry, violation));
	return matching.find((entry) => entry.subject !== undefined) ?? matching[0];
};

export const applyRegistry = (violations: readonly Violation[], entries: readonly RegistryEntry[], rules: RuleIndex): RegistryCheck => {
	const usable = entries.filter((entry) => registrable(rules, entry.rule));
	const used = new Set<RegistryEntry>();
	const kept = violations.filter((violation) => {
		const entry = coveringEntry(usable, violation);
		if (entry !== undefined) {
			used.add(entry);
		}
		return entry === undefined;
	});
	const stale = entries
		.filter((entry) => !used.has(entry))
		.map((entry) => ({
			entry,
			problem: registrable(rules, entry.rule) ? unusedEntryProblem(rules, entry.rule, "matches no violation") : UNREGISTRABLE,
		}));
	return { kept, registered: violations.length - kept.length, stale };
};
