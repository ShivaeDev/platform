import type { StaleBaselineEntry } from "#baseline/compare.ts";
import type { Outcome } from "#engine/evaluate.ts";
import { groupBy } from "#engine/violation.ts";
import type { StaleRegistryEntry } from "#exceptions/registry.ts";
import { plural } from "#report/plural.ts";

interface StaleFiles {
	readonly baseline: string;
	readonly registry: string;
}

function section(label: string, file: string, guidance: string, lines: readonly string[]): readonly string[] {
	return lines.length === 0
		? []
		: [[`${label} ${file}: ${plural(lines.length, "stale entry", "stale entries")}`, `  ${guidance}`, ...lines].join("\n")];
}

function unsplitSection(file: string, unsplit: readonly StaleBaselineEntry[]): readonly string[] {
	if (unsplit.length === 0) {
		return [];
	}
	const rules = [...groupBy(unsplit, ({ entry }) => entry.rule)]
		.map(([rule, entries]) => `${rule} ${entries.length}`)
		.sort((left, right) => left.localeCompare(right));
	return [
		`note ${file}: ${plural(unsplit.length, "entry does", "entries do")} not record how many findings the deep half reports (${rules.join(", ")}). Run \`quality baseline prune\` once to record it, so a local lint locks in fixed debt of the fast half.`,
	];
}

function baselineLine({ entry, problem }: StaleBaselineEntry): string {
	return `  ${entry.rule} ${entry.file} ${problem}.`;
}

function registryLine({ entry, problem }: StaleRegistryEntry): string {
	return `  ${entry.rule} ${entry.file}${entry.subject === undefined ? "" : ` (${entry.subject})`} ${problem}.`;
}

export function staleSections(outcome: Outcome, files: StaleFiles): readonly string[] {
	return [
		...section(
			"error",
			files.baseline,
			"Drop unknown rules with `quality baseline prune`. Lower staged counts with `quality baseline tighten --staged`, then stage the baseline.",
			outcome.staleBaseline.map(baselineLine),
		),
		...section(
			"note",
			files.baseline,
			"These pass, and `quality baseline tighten` lowers them when their files change. `quality baseline prune` lowers them all.",
			outcome.looseBaseline.map(baselineLine),
		),
		...unsplitSection(files.baseline, outcome.unsplitBaseline),
		...section(
			"error",
			files.registry,
			"Every registered exception must still apply. Remove the entries whose exception is gone.",
			outcome.staleRegistry.map(registryLine),
		),
	];
}
