import { expect, it } from "vitest";
import { runVitest } from "#test/runVitest.ts";

it("uses a numeric timeout to interrupt a stalled application", () => {
	const result = runVitest("timeoutFixture.ts");
	expect(result.status).toBe(1);
	expect(result.tests).toHaveLength(2);
	expect(result.tests[0]).toMatchObject({ status: "failed", title: "stalled application" });
	expect(result.tests[1]).toMatchObject({ status: "passed", title: "reports the numeric timeout and closes the interrupted test scope" });
}, 60_000);

it("reports a worker startup error and releases acquired resources before another test", () => {
	const result = runVitest("startupFailureFixture.ts");
	expect(result.status).toBe(1);
	expect(result.tests).toHaveLength(2);
	expect(result.tests[0]).toMatchObject({ status: "failed", title: "cannot start the application" });
	expect(result.tests[0]?.failureMessages.join("\n")).toContain("database connection refused during worker startup");
	expect(result.tests[1]).toMatchObject({ status: "passed", title: "releases the acquired connection before the next test" });
}, 60_000);
