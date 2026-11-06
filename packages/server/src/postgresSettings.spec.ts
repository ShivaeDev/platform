import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { configuredSetting, equivalentMemorySetting, nonSuperuser, postgresSettings } from "#test/postgres-settings/story.ts";

postgresSettings.it(
	"startup applies a differing reloadable value and PostgreSQL exposes it",
	[configuredSetting("log_min_duration_sample", "12000", "13s")],
	function* ({ liveSetting, settingReloads, start }) {
		expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "12000" });

		yield* start();
		yield* settingReloads("log_min_duration_sample", "13000");

		expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "13000" });
	},
);

postgresSettings.it(
	"a non-superuser warns with the setting, live and wanted values and startup still runs migrations",
	[configuredSetting("log_min_duration_sample", "12000", "13s"), nonSuperuser],
	function* ({ migrationRan, recordedWarnings, start }) {
		yield* start();

		yield* outcomes([
			["migration ran", () => migrationRan(), true],
			[
				"recorded warning",
				() => recordedWarnings(),
				[{ level: "Warn", message: ["Could not apply PostgreSQL setting", { live: "12000 ms", setting: "log_min_duration_sample", wanted: "13s" }] }],
			],
		]);
	},
);

for (const [description, traits] of [
	["time units", [configuredSetting("log_min_duration_sample", "12000", "12s")]],
	["memory units", [equivalentMemorySetting]],
] as const) {
	postgresSettings.it(`an equal value in equivalent ${description} issues no ALTER SYSTEM`, traits, function* ({ alterStatements, start }) {
		yield* start();

		expect(yield* alterStatements()).toEqual([]);
	});
}

postgresSettings.it(
	"startup logs a restart-only setting with its wanted value while leaving the live value until restart",
	[configuredSetting("max_files_per_process", "1000", "1001")],
	function* ({ liveSetting, recordedWarnings, restartIsPending, start }) {
		yield* start();
		yield* restartIsPending("max_files_per_process");

		yield* outcomes([
			["live setting", () => liveSetting("max_files_per_process"), { "pending_restart": true, setting: "1000" }],
			[
				"recorded warning",
				() => recordedWarnings(),
				[{ level: "Warn", message: ["PostgreSQL setting pending restart", { setting: "max_files_per_process", wanted: "1001" }] }],
			],
		]);
	},
);

postgresSettings.it(
	"a refused value warns with the setting, live and wanted values and startup still runs migrations",
	[configuredSetting("log_min_duration_sample", "12000", "-2")],
	function* ({ migrationRan, recordedWarnings, start }) {
		yield* start();

		yield* outcomes([
			["migration ran", () => migrationRan(), true],
			[
				"recorded warning",
				() => recordedWarnings(),
				[{ level: "Warn", message: ["Could not apply PostgreSQL setting", { live: "12000 ms", setting: "log_min_duration_sample", wanted: "-2" }] }],
			],
		]);
	},
);
