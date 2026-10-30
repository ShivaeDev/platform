import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { migrated, migrationHost } from "#test/app-host/migrationStory.ts";

migrationHost.it(
	"check mode serves requests without the configured release marker and logs no wait",
	[migrated],
	function* ({ applicationLifecycle, bootStep, hostStarts, migrationLogMessages, pingHost }) {
		yield* hostStarts({ mode: "check", release: "unrecorded" });

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), ["started"]],
			"boot step": [bootStep(), "ready"],
			"migration logs": [migrationLogMessages(), []],
			ping: [pingHost(), "pong"],
		});
	},
);

migrationHost.it(
	"waiting for an unrecorded release fails startup with a migration error when the poll budget expires, logging the missing release",
	[migrated],
	function* ({ applicationLifecycle, hostEnding, hostStarts, migrationLog, pollBudgetExpires }) {
		yield* hostStarts({ release: "next", waitTimeout: "25 millis" });

		yield* pollBudgetExpires();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), []],
			"host ending": [hostEnding(), "failed with migration error"],
			"timeout log": [
				migrationLog("Timed out waiting for database migrations"),
				{
					annotations: { pendingComponents: [{ detail: "Expected release next; recorded none", name: "database release" }], pendingMigrations: [] },
					level: "Info",
				},
			],
		});
	},
);
