import { Effect } from "effect";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { settingsEngine } from "#test/postgres-settings/engine.ts";

export const postgresSettingsCanApply = databaseUrl !== undefined && new URL(databaseUrl).port !== "55432";

export const postgresSettings = storyKit({
	around: withIsolatedDatabase,
	create: settingsEngine,
	inspect: (engine) => ({ logs: engine.logs, settings: engine.state.settings }),
	layer: postgres,
	name: "PostgreSQL settings on app start",
	stages: ["configured"],
	verbs: (engine, story) => ({
		alterStatements: () =>
			Effect.sync(() => engine.spans.map((span) => String(span.attributes.get("db.query.text"))).filter((query) => query.startsWith("ALTER SYSTEM"))),
		liveSetting: (name: string) => Effect.map(engine.read(name), (rows) => rows[0]),
		migrationRan: () => Effect.sync(() => engine.state.migrated),
		recordedWarnings: () => Effect.sync(() => engine.logs.filter((entry) => entry.level === "Warn")),
		restartIsPending: (name: string) => observeUntil(engine.read(name), (rows) => rows[0]?.pending_restart === true, `${name} waits for restart`),
		settingReloads: (name: string, value: string) =>
			observeUntil(engine.read(name), (rows) => rows[0]?.setting === value, `${name} reloads to ${value}`),
		start: () => {
			story.tell("the app builds its database and runs its startup migrations");
			return engine.start();
		},
	}),
});

export function configuredSetting(name: string, live: string, wanted: string) {
	return postgresSettings.trait("configured", `${name} is ${live} and the app declares ${wanted}`, function* (engine) {
		yield* engine.withSetting(name, live);
		engine.state.settings = { [name]: wanted };
	});
}

export const equivalentMemorySetting = postgresSettings.trait(
	"configured",
	"the app declares the live WAL segment size in kilobytes",
	function* (engine) {
		const [setting] = yield* engine.read("wal_segment_size");
		engine.state.settings = { "wal_segment_size": `${Number(setting?.setting) / 1024}kB` };
	},
);

export const nonSuperuser = postgresSettings.trait("configured", "the app connects with a non-superuser role", function* (engine) {
	yield* engine.withoutSuperuser();
});

export const railwayDeployment = postgresSettings.trait("configured", "the process has Railway deployment variables", (engine) =>
	Effect.sync(() => {
		engine.state.env = {
			"RAILWAY_DEPLOYMENT_ID": "deployment",
			"RAILWAY_ENVIRONMENT_ID": "environment",
			"RAILWAY_REPLICA_ID": "replica",
			"RAILWAY_SERVICE_ID": "service",
		};
	}),
);

export const railwayRun = postgresSettings.trait("configured", "railway run injects service variables without a deployment replica", (engine) =>
	Effect.sync(() => {
		engine.state.env = { "RAILWAY_ENVIRONMENT_ID": "environment", "RAILWAY_SERVICE_ID": "service" };
	}),
);

export function hostKind(host: "database" | "http" | "deferred" | "worker") {
	return postgresSettings.trait("configured", `the app starts its ${host} host`, (engine) =>
		Effect.sync(() => {
			engine.state.host = host;
		}),
	);
}

export function developmentPostgres(source: "authority" | "parameters") {
	return postgresSettings.trait("configured", `the app connects to development PostgreSQL through the URL ${source}`, function* (engine) {
		yield* engine.useDevelopmentPort(source);
	});
}
