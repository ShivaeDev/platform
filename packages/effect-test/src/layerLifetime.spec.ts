import { expect } from "vitest";
import { runner } from "#test/runner.ts";

runner.effectApp(
	"closes the service Layer before Vitest reports its file complete",
	function* ({ runVitest }) {
		const result = yield* runVitest("layerLifetimeFixture.ts", "src/test-support/LayerLifetimeReporter.config.ts");
		expect(result.status).toBe(0);
		expect(result.tests.map(({ status }) => status)).toEqual(["passed", "passed"]);
		expect(result.output).toContain("Layer at file completion: ECONNREFUSED");
	},
	60_000,
);
