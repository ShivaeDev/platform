import { Console, Effect } from "effect";
import type { BaselineEntry } from "#baseline/format.ts";
import { covers, groupBy } from "#engine/violation.ts";
import { plural } from "#report/plural.ts";

export const reportBaselineWrite = Effect.fn("Cli.reportBaselineWrite")(function* (
	before: readonly BaselineEntry[],
	after: readonly BaselineEntry[],
	rules: readonly string[],
) {
	const recorded = after.filter((entry) => rules.length === 0 || rules.some((rule) => covers(rule, entry.rule)));
	const previousRules = new Set(before.map((entry) => entry.rule));
	yield* Console.log("First, fix every finding you can fix instead of recording it. Run `quality baseline tighten` after repairs.");
	yield* Console.log(
		"Then, for rules new since the previous baseline, review each recorded case and judge whether the rule reads the code correctly. Report any misread to Platform with the file, lines and what Quality would need instead of leaving it as debt.",
	);
	yield* Console.log("Recorded findings by rule:");
	for (const [rule, entries] of [...groupBy(recorded, (entry) => entry.rule)].sort(([left], [right]) => left.localeCompare(right))) {
		const count = entries.reduce((total, entry) => total + entry.count, 0);
		const added = previousRules.has(rule) ? "" : " (new since previous baseline)";
		yield* Console.log(`  ${rule}: ${plural(count, "finding", "findings")}${added}`);
	}
	if (recorded.length === 0) {
		yield* Console.log("  none");
	}
});
