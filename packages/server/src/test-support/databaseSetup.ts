import { randomUUID } from "node:crypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, ConfigProvider, Effect } from "effect";
import { LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { setupDatabases } from "#setupDatabases.ts";

export const hasTestDatabase = environmentVariable("TEST_DATABASE_URL") !== undefined;

type Setting = "DATABASE_URL" | "TEST_DATABASE_URL";

export const databaseSetup = storyKit({
	clock: "live",
	create: () => {
		const unique = randomUUID().replaceAll("-", "");
		const env: Partial<Record<Setting, string>> = {
			"DATABASE_URL": `${LOCAL_SERVER}/local_${unique}`,
			"TEST_DATABASE_URL": `${LOCAL_SERVER}/specs_${unique}`,
		};
		return Effect.succeed({ env, postgres: localPostgres({}), unique });
	},
	layer: NodeServices.layer,
	name: "database setup",
	stages: [],
	verbs: (state, story) => {
		const cleanup = Effect.gen(function* () {
			for (const value of Object.values(state.env)) {
				yield* state.postgres.sql(`${LOCAL_SERVER}/postgres`, `DROP DATABASE IF EXISTS "${new URL(value).pathname.slice(1)}"`);
			}
		});
		const prepare = Effect.acquireRelease(
			Effect.suspend(() => setupDatabases().pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { ...state.env } }))))),
			() => cleanup.pipe(Effect.orDie),
		);
		return {
			connectedDatabases: () =>
				Effect.forEach(Object.entries(state.env), ([setting, url]) =>
					Effect.map(state.postgres.sql(url, "SELECT current_database()"), (name) => [setting, name.replace(state.unique, "<unique>")]),
				).pipe(Effect.map(Object.fromEntries)),
			prepareDatabases: () => {
				story.tell("the application prepares the databases named in DATABASE_URL and TEST_DATABASE_URL");
				return prepare;
			},
			prepareDatabasesWithout: (missing: Setting) => {
				story.tell(`the application prepares its databases without ${missing}`);
				delete state.env[missing];
				return answered(prepare, (error) =>
					error instanceof Config.ConfigError
						? `a config error about ${/at \["(?<setting>[^"]+)"\]/u.exec(error.message)?.groups?.setting ?? error.message}`
						: String(error),
				);
			},
		};
	},
});
