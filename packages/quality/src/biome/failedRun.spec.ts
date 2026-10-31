import { expect } from "vitest";
import { biomeReports } from "#test/biomeReports.ts";

biomeReports.it(
	"a Biome run that exits without a report fails with the command Biome ran, its exit code and Biome's error output",
	[],
	function* ({ failure, requestsReportForUnknownCommand }) {
		yield* requestsReportForUnknownCommand();

		expect(yield* failure()).toBe(
			"biome unknown-command --reporter=json --max-diagnostics=none . exited 1 without a report:\nError: expected `COMMAND ...`, got `unknown-command`. Pass `--help` for usage information",
		);
	},
);
