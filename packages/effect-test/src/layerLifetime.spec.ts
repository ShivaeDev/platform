import { expect, it } from "vitest";
import { runVitest } from "#test/runVitest.ts";

const SUCCESSFUL_EXIT = 0;

it("closes the service Layer before Vitest reports its file complete", () => {
	const result = runVitest("layerLifetimeFixture.ts", "src/test-support/LayerLifetimeReporter.config.ts");
	expect(result.status).toBe(SUCCESSFUL_EXIT);
	expect(result.tests.map(({ status }) => status)).toEqual(["passed", "passed"]);
	expect(result.output).toContain("Layer at file completion: ECONNREFUSED");
}, 60_000);
