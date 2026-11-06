import { Effect } from "effect";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgres } from "#test/postgres.ts";
import { settingsEngine } from "./engine.ts";

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
