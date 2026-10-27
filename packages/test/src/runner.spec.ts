import { expect } from "vitest";
import { runner } from "#test/runner.ts";

runner.effectApp(
	"uses a numeric timeout to interrupt a stalled application",
	function* ({ runVitest }) {
		const result = yield* runVitest("timeoutFixture.ts");
		expect(result.status).toBe(1);
		expect(result.tests).toMatchObject([
			{ status: "failed", title: "stalled application" },
			{ status: "passed", title: "reports the numeric timeout and closes the interrupted test scope" },
		]);
	},
	60_000,
);

runner.effectApp(
	"reports a worker startup error and releases acquired resources before another test",
	function* ({ runVitest }) {
		const result = yield* runVitest("startupFailureFixture.ts");
		expect(result.status).toBe(1);
		expect(result.tests).toMatchObject([
			{
				failureMessages: [expect.stringContaining("database connection refused during worker startup")],
				status: "failed",
				title: "cannot start the application",
			},
			{ status: "passed", title: "releases the acquired connection before the next test" },
		]);
	},
	60_000,
);
