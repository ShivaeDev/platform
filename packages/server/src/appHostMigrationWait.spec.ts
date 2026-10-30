import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldDisconnects, initiallyMigrated, invalidLedger, migrated, migrationHost } from "#test/app-host/migrationStory.ts";
import { pendingJobsSchema } from "#test/app-host/withJobsSchema.ts";

const pendingReady = { pendingComponents: [], pendingMigrations: [{ id: 2, name: "ready" }] };

for (const [ledger, traits] of [
	["missing", []],
	["pending", [initiallyMigrated]],
] as const) {
	migrationHost.it(
		`with a ${ledger} ledger, the host waits without starting the application until another process migrates, then serves requests`,
		traits,
		function* ({ anotherProcessMigrates, applicationLifecycle, bootStep, hostStarts, migrationLogMessages, pingHost, pollIntervalPasses }) {
			yield* hostStarts();
			yield* outcomes({ "application lifecycle": [applicationLifecycle(), []], "boot step": [bootStep(), "sleeps 10 ms"] });

			yield* anotherProcessMigrates();
			yield* pollIntervalPasses();

			yield* outcomes({
				"application lifecycle": [applicationLifecycle(), ["started"]],
				"boot step": [bootStep(), "ready"],
				"migration logs": [migrationLogMessages(), ["Waiting for database migrations", "Database migrations current"]],
				ping: [pingHost(), "pong"],
			});
		},
	);
}

migrationHost.it(
	"when the poll budget expires, the waiting host fails with check mode's migration error, logs the pending migration and never starts the application",
	[initiallyMigrated],
	function* ({ applicationLifecycle, checkStartup, hostStarts, migrationLog, migrationLogMessages, pollBudgetExpires, startupFailure }) {
		const checked = yield* checkStartup();
		yield* hostStarts({ waitTimeout: "25 millis" });

		yield* pollBudgetExpires();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), []],
			"migration logs": [migrationLogMessages(), ["Waiting for database migrations", "Timed out waiting for database migrations"]],
			"startup failure": [startupFailure(), checked],
			"timeout log": [migrationLog("Timed out waiting for database migrations"), { annotations: pendingReady, level: "Info" }],
		});
	},
);

migrationHost.it(
	"with a current ledger the host is ready at once, starts the application and logs no migration wait",
	[migrated],
	function* ({ applicationLifecycle, bootStep, hostStarts, migrationLogMessages, pingHost }) {
		yield* hostStarts();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), ["started"]],
			"boot step": [bootStep(), "ready"],
			"migration logs": [migrationLogMessages(), []],
			ping: [pingHost(), "pong"],
		});
	},
);

migrationHost.it(
	"an unreadable ledger fails startup at once with its SQL error and never starts the application",
	[invalidLedger],
	function* ({ applicationLifecycle, bootStep, hostStarts }) {
		yield* hostStarts();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), []],
			"boot step": [bootStep(), "failed with sql error"],
		});
	},
);

migrationHost.it(
	"interrupting a waiting host finishes only after its pool disconnects, closing every connection without starting the application",
	[heldDisconnects],
	function* ({
		applicationLifecycle,
		hostEnding,
		hostStarts,
		interruptionProgress,
		openPoolConnections,
		peerAcknowledgesDisconnects,
		theHostIsInterrupted,
	}) {
		yield* hostStarts();
		expect(yield* openPoolConnections()).toBe("one open connection");
		yield* theHostIsInterrupted();
		expect(yield* interruptionProgress()).toBe("waiting for the pool to disconnect");

		yield* peerAcknowledgesDisconnects();

		yield* outcomes({
			"application lifecycle": [applicationLifecycle(), []],
			"host ending": [hostEnding(), "interrupted"],
			"open pool connections": [openPoolConnections(), "no open connections"],
		});
	},
);

migrationHost.it(
	"a waiting host repeats its pending ledger IDs and pg-boss component on the progress interval, independent of polling",
	[pendingJobsSchema],
	function* ({ hostStarts, migrationLog, migrationLogMessages, timePasses }) {
		yield* hostStarts({ pollInterval: "1 second", progressInterval: "25 millis" });
		const waiting = {
			annotations: {
				pendingComponents: [
					{
						detail: expect.stringMatching(/installed version missing, required version \d+$/u),
						name: expect.stringMatching(/^pg-boss:waiting_[a-f0-9]+_jobs$/u),
					},
				],
				pendingMigrations: [
					{ id: 1, name: "initial" },
					{ id: 2, name: "ready" },
				],
			},
			level: "Info",
		};
		expect(yield* migrationLog("Waiting for database migrations")).toEqual(waiting);

		yield* timePasses("25 millis");

		yield* outcomes({
			"migration logs": [migrationLogMessages(), ["Waiting for database migrations", "Still waiting for database migrations"]],
			"progress log": [migrationLog("Still waiting for database migrations"), waiting],
		});
	},
);
