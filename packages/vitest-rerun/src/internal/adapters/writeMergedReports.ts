import { Effect } from "effect";
import type { Vitest } from "vitest/node";
import { failWith } from "#error.ts";
import { RerunJunitReporter } from "#internal/junit.ts";
import { TimedJsonReporter } from "./TimedJsonReporter.ts";

export function writeMergedReports(
	vitest: Vitest,
	reports: { json: string; junit: string },
	coverage: unknown,
	errors: RerunJunitReporter["unhandledErrors"],
) {
	return Effect.tryPromise({
		catch: failWith("Vitest could not write the merged reports"),
		try: async () => {
			const json = new TimedJsonReporter({ outputFile: reports.json });
			const junit = new RerunJunitReporter(reports.junit);
			await json.onInit(vitest);
			if (coverage !== undefined) {
				json.onCoverage(coverage);
			}
			await json.onTestRunEnd(vitest.state.getTestModules());
			await junit.onInit(vitest);
			await junit.onTestRunEnd(vitest.state.getTestModules(), errors);
		},
	});
}
