import type { StaleBaselineEntry } from "../baseline/compare.ts";
import type { Outcome } from "../engine/evaluate.ts";
import type { StaleRegistryEntry } from "../exceptions/registry.ts";
import { plural } from "./plural.ts";

interface StaleFiles {
	readonly baseline: string;
	readonly registry: string;
}

const section = (label: string, file: string, guidance: string, lines: ReadonlyArray<string>): ReadonlyArray<string> =>
	lines.length === 0 ? [] : [[`${label} ${file}: ${plural(lines.length, "stale entry", "stale entries")}`, `  ${guidance}`, ...lines].join("\n")];

const baselineLine = ({ entry, problem }: StaleBaselineEntry): string => `  ${entry.rule} ${entry.file} ${problem}.`;

const registryLine = ({ entry, problem }: StaleRegistryEntry): string =>
	`  ${entry.rule} ${entry.file}${entry.subject === undefined ? "" : ` (${entry.subject})`} ${problem}.`;

export const staleSections = (outcome: Outcome, files: StaleFiles): ReadonlyArray<string> => [
	...section(
		"error",
		files.baseline,
		"An entry for a rule that is off or unknown covers nothing. Run `quality baseline prune` to drop it.",
		outcome.staleBaseline.map(baselineLine),
	),
	...section(
		"note",
		files.baseline,
		"These pass, and `quality baseline tighten` lowers them when their files change. `quality baseline prune` lowers them all.",
		outcome.looseBaseline.map(baselineLine),
	),
	...section(
		"error",
		files.registry,
		"Every registered exception must still apply. Remove the entries whose exception is gone.",
		outcome.staleRegistry.map(registryLine),
	),
];
