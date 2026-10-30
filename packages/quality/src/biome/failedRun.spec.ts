import { expect } from "vitest";
import { biomeReports } from "#test/biomeReports.ts";

biomeReports.it("a failing Biome run reports its exit code and stderr", [], function* ({ failure, runUnsupportedCommand }) {
	yield* runUnsupportedCommand();

	expect(failure()).toBe(
		"biome unknown-command --reporter=json --max-diagnostics=none . exited 1 without a report:\nError: expected `COMMAND ...`, got `unknown-command`. Pass `--help` for usage information",
	);
});
