import { ConfigProvider, Effect } from "effect";
import { localPostgres, localServer } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { setupDatabases } from "#server/setupDatabases.ts";

export const databaseSetup = storyKit({
	clock: "live",
	create: () => localPostgres({}),
	name: "database setup",
	stages: [],
	verbs: (postgres, story) => ({
		connectedDatabase: (url: string) => Effect.sync(() => postgres.sql(url, "SELECT current_database()")),
		prepare: (env: Record<string, string>) => {
			story.tell("prepare the application's databases using Effect configuration");
			const cleanup = Effect.sync(() => {
				for (const key of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
					const value = env[key];
					if (value !== undefined) {
						const name = new URL(value).pathname.slice(1);
						postgres.sql(`${localServer}/postgres`, `DROP DATABASE IF EXISTS "${name}"`);
					}
				}
			});
			return Effect.acquireRelease(setupDatabases().pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))), () => cleanup);
		},
	}),
});
