import type { Outcome } from "#engine/evaluate.ts";
import { groupBy } from "#engine/violation.ts";
import { plural } from "#report/plural.ts";
import { failures, type ReportContext } from "#report/render.ts";

const FILES_SHOWN = 3;

function firstFiles(files: readonly string[]): string {
	const distinct = [...new Set(files)];
	const shown = distinct.slice(0, FILES_SHOWN).join(", ");
	return distinct.length > FILES_SHOWN ? `${shown} and ${plural(distinct.length - FILES_SHOWN, "more file")}` : shown;
}

function staleLine(file: string, entries: readonly { readonly entry: { readonly file: string } }[]): readonly string[] {
	return entries.length === 0
		? []
		: [`  error ${file} (${plural(entries.length, "stale entry", "stale entries")}): ${firstFiles(entries.map(({ entry }) => entry.file))}`];
}

export function recap(outcome: Outcome, context: ReportContext): string {
	return [
		`quality lint failed with ${failures(outcome)}:`,
		...[...groupBy(outcome.errors, (violation) => violation.rule).entries()].map(
			([rule, inRule]) => `  error ${rule} (${inRule.length}): ${firstFiles(inRule.map((violation) => violation.file))}`,
		),
		...staleLine(context.baseline, outcome.staleBaseline),
		...staleLine(context.registry, outcome.staleRegistry),
	].join("\n");
}
