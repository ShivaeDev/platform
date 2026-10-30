import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { migrationHost } from "#test/app-host/migrationStory.ts";
import { withJobsSchema } from "#test/app-host/withJobsSchema.ts";

for (const version of ["missing", "older"] as const) {
	migrationHost.it(
		`with a current ledger and a ${version} pg-boss schema, the host waits without starting the application until another process migrates, then serves requests`,
		[withJobsSchema(version)],
		function* ({ anotherProcessMigrates, applicationLifecycle, bootStep, hostStarts, pingHost, pollIntervalPasses }) {
			yield* hostStarts();
			yield* outcomes({ "application lifecycle": [applicationLifecycle(), []], "boot step": [bootStep(), "sleeps 10 ms"] });

			yield* anotherProcessMigrates();
			yield* pollIntervalPasses();

			yield* outcomes({
				"application lifecycle": [applicationLifecycle(), ["started"]],
				"boot step": [bootStep(), "ready"],
				ping: [pingHost(), "pong"],
			});
		},
	);
}

migrationHost.it(
	"check mode fails naming the pending pg-boss component with its installed and required versions",
	[withJobsSchema("older")],
	function* ({ checkStartup }) {
		expect(yield* checkStartup()).toEqual({
			error: "migration error",
			kind: "BadState",
			message: expect.stringMatching(/component pg-boss:.*installed version 45, required version 46/u),
		});
	},
);

migrationHost.it(
	"with a current ledger and pg-boss schema the host is ready at once and starts the application",
	[withJobsSchema("current")],
	function* ({ applicationLifecycle, bootStep, hostStarts, pingHost }) {
		yield* hostStarts();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), ["started"]],
			"boot step": [bootStep(), "ready"],
			ping: [pingHost(), "pong"],
		});
	},
);
