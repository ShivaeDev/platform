import { expect } from "vitest";
import { runner } from "#test/runner.ts";

runner.effectApp(
	"uses a numeric timeout to interrupt a stalled application",
	function* ({ runVitest }) {
		const result = yield* runVitest("timeoutFixture.ts");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.tests).toMatchObject([
			{ status: "failed", title: "stalled application" },
			{ status: "passed", title: "reports the numeric timeout and closes the interrupted test scope" },
		]);
	},
	60_000,
);

runner.effectApp(
	"fails a stuck finalizer with its scope name and continues the run",
	function* ({ runVitest }) {
		const result = yield* runVitest("stuckFinalizerFixture.ts");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.tests).toMatchObject([
			{
				failureMessages: [
					expect.stringContaining("Test timed out in 25ms."),
					expect.stringContaining('Test scope "application with stuck cleanup" did not close within 5000ms.'),
				],
				status: "failed",
				title: "application with stuck cleanup",
			},
			{ status: "passed", title: "runs after the scope close timeout" },
		]);
		expect(result.tests[0]?.duration).toBeLessThan(10_000);
	},
	60_000,
);

runner.effectApp(
	"reports a worker startup error and releases acquired resources before another test",
	function* ({ runVitest }) {
		const result = yield* runVitest("startupFailureFixture.ts");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
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
