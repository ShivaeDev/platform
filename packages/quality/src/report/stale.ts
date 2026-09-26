import type { StaleBaselineEntry } from "../baseline/compare.ts";
import type { Outcome } from "../engine/evaluate.ts";
import type { StaleRegistryEntry } from "../exceptions/registry.ts";
import { plural } from "./plural.ts";

interface StaleFiles {
	readonly registry: string;
	readonly baseline: string;
}

const section = (file: string, guidance: string, lines: ReadonlyArray<string>): ReadonlyArray<string> =>
	lines.length === 0 ? [] : [[`error ${file}: ${plural(lines.length, "stale entry", "stale entries")}`, `  ${guidance}`, ...lines].join("\n")];

const baselineLine = ({ entry, problem }: StaleBaselineEntry): string => `  ${entry.rule} ${entry.file} ${problem}.`;

const registryLine = ({ entry, problem }: StaleRegistryEntry): string =>
	`  ${entry.rule} ${entry.file}${entry.subject === undefined ? "" : ` (${entry.subject})`} ${problem}.`;

export const staleSections = (outcome: Outcome, files: StaleFiles): ReadonlyArray<string> => [
	...section(
		files.baseline,
		"The baseline only shrinks. Run `quality baseline prune` to drop fixed debt; prune never adds or raises an entry.",
		outcome.staleBaseline.map(baselineLine),
	),
	...section(
		files.registry,
		"Every registered exception must still apply. Remove the entries whose exception is gone.",
		outcome.staleRegistry.map(registryLine),
	),
];
