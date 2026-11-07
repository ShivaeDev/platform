import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	configuredSetting,
	developmentPostgres,
	equivalentMemorySetting,
	hostKind,
	nonSuperuser,
	postgresSettings,
	postgresSettingsCanApply,
	railwayDeployment,
	railwayRun,
} from "#test/postgres-settings/story.ts";

postgresSettings.it.runIf(postgresSettingsCanApply)(
	"a non-superuser warns with the setting, live and wanted values and startup still runs migrations",
	[railwayDeployment, configuredSetting("log_min_duration_sample", "12000", "13s"), nonSuperuser],
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
	["time units", [railwayDeployment, configuredSetting("log_min_duration_sample", "12000", "12s")]],
	["memory units", [railwayDeployment, equivalentMemorySetting]],
] as const) {
	postgresSettings.it(`an equal value in equivalent ${description} issues no ALTER SYSTEM`, traits, function* ({ alterStatements, start }) {
		yield* start();

		expect(yield* alterStatements()).toEqual([]);
	});
}

postgresSettings.it.runIf(postgresSettingsCanApply)(
	"startup logs a restart-only setting with its wanted value while leaving the live value until restart",
	[railwayDeployment, configuredSetting("max_files_per_process", "1000", "1001")],
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

postgresSettings.it.runIf(postgresSettingsCanApply)(
	"a refused value warns with the setting, live and wanted values and startup still runs migrations",
	[railwayDeployment, configuredSetting("log_min_duration_sample", "12000", "-2")],
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

for (const host of ["database", "http", "deferred", "worker"] as const) {
	for (const [environment, traits] of [
		["without Railway variables", []],
		["under railway run", [railwayRun]],
	] as const) {
		postgresSettings.it(
			`${host} startup ${environment} leaves PostgreSQL settings unchanged`,
			[hostKind(host), configuredSetting("log_min_duration_sample", "12000", "13s"), ...traits],
			function* ({ liveSetting, alterStatements, start }) {
				expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "12000" });

				yield* start();

				yield* outcomes([
					["live setting", () => liveSetting("log_min_duration_sample"), { setting: "12000" }],
					["server changes", () => alterStatements(), []],
				]);
			},
		);
	}
	postgresSettings.it.runIf(postgresSettingsCanApply)(
		`${host} startup on Railway applies the declared PostgreSQL setting`,
		[hostKind(host), railwayDeployment, configuredSetting("log_min_duration_sample", "12000", "13s")],
		function* ({ liveSetting, settingReloads, start }) {
			expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "12000" });

			yield* start();
			yield* settingReloads("log_min_duration_sample", "13000");

			expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "13000" });
		},
	);
	for (const source of ["authority", "parameters"] as const) {
		postgresSettings.it(
			`${host} startup with all Railway variables leaves development PostgreSQL unchanged via URL ${source}`,
			[hostKind(host), railwayDeployment, developmentPostgres(source), configuredSetting("log_min_duration_sample", "12000", "13s")],
			function* ({ liveSetting, alterStatements, start }) {
				expect(yield* liveSetting("log_min_duration_sample")).toMatchObject({ setting: "12000" });

				yield* start();

				yield* outcomes([
					["live setting", () => liveSetting("log_min_duration_sample"), { setting: "12000" }],
					["server changes", () => alterStatements(), []],
				]);
			},
		);
	}
}
