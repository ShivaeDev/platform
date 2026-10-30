import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { developmentApp } from "#test/developmentApp.ts";

developmentApp.it("the development runner starts the server and worker under the application condition", [], function* ({ appConditions, start }) {
	yield* start();

	expect(yield* appConditions()).toEqual({ server: "application", worker: "application" });
});

developmentApp.it(
	"when Vite exits with status 7, the development runner exits with 7 and leaves no app process running",
	[],
	function* ({ runningAppProcesses, start, viteExits }) {
		yield* start();
		expect(yield* runningAppProcesses()).toEqual(["server", "vite", "worker"]);

		const exitCode = yield* viteExits();

		yield* outcomes({
			"runner exit code": [Effect.succeed(exitCode), 7],
			"running app processes": [runningAppProcesses(), []],
		});
	},
);
