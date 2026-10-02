import { Schema } from "effect";
import type { Level } from "../config.ts";
import { type Decoded, decodeWith } from "../decoded.ts";
import { unusedEntryProblem, type Violation } from "../engine/violation.ts";

const RegistryEntry = Schema.Struct({
	rule: Schema.NonEmptyString,
	file: Schema.NonEmptyString,
	subject: Schema.optionalKey(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/, { expected: "a reason that says why the exception is permanent" })),
});

export type RegistryEntry = typeof RegistryEntry.Type;

const standard = Schema.toStandardSchemaV1(Schema.fromJsonString(Schema.Array(RegistryEntry)), {
	parseOptions: { errors: "all", onExcessProperty: "error" },
});

export const decodeRegistry = (raw: string | undefined): Promise<Decoded<ReadonlyArray<RegistryEntry>>> =>
	raw === undefined ? Promise.resolve({ _tag: "Valid", value: [] }) : decodeWith(standard, raw);

export interface StaleRegistryEntry {
	readonly entry: RegistryEntry;
	readonly problem: string;
}

export interface RegistryCheck {
	readonly kept: ReadonlyArray<Violation>;
	readonly registered: number;
	readonly stale: ReadonlyArray<StaleRegistryEntry>;
}

const covers = (entry: RegistryEntry, violation: Violation): boolean =>
	entry.rule === violation.rule && entry.file === violation.file && (entry.subject === undefined || entry.subject === violation.subject);

const UNREGISTRABLE = "names a rule that takes no exceptions. Fix the code, or baseline the violations while the repository adopts the rule";

const coveringEntry = (entries: ReadonlyArray<RegistryEntry>, violation: Violation): RegistryEntry | undefined => {
	const matching = entries.filter((entry) => covers(entry, violation));
	return matching.find((entry) => entry.subject !== undefined) ?? matching[0];
};

export const applyRegistry = (
	violations: ReadonlyArray<Violation>,
	entries: ReadonlyArray<RegistryEntry>,
	levels: ReadonlyMap<string, Level>,
	unregistrable: ReadonlySet<string>,
): RegistryCheck => {
	const usable = entries.filter((entry) => !unregistrable.has(entry.rule));
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
			problem: unregistrable.has(entry.rule) ? UNREGISTRABLE : unusedEntryProblem(levels, entry.rule, "matches no violation"),
		}));
	return { kept, registered: violations.length - kept.length, stale };
};
