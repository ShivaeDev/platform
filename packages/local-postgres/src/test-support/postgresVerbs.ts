import { Effect } from "effect";
import { sqlInContainer, startContainer } from "#local-container.ts";
import { docker } from "#local-docker.ts";
import { assertLocalDatabase, localServer } from "#localPostgres.ts";
import type { PostgresEngine } from "#test/postgresEngine.ts";
import { containerQuery, prepareTwice, queryAsNewRole } from "#test/realPostgres.ts";

export function postgresVerbs(engine: PostgresEngine, tell: (line: string) => void) {
	function localDocker(args: readonly string[]) {
		return docker(engine.environment, args);
	}
	return {
		assertDatabase: (value: string, names: readonly string[]) => assertLocalDatabase(value, names),
		containerQuery: (query: string) => containerQuery(engine, new URL(`${localServer}/postgres`), query),
		contextInspections: () => engine.calls.filter(([file, command]) => file === "docker" && command === "context"),
		databaseUrl: (name: string) => `${localServer}/${name}`,
		operations: () => engine.calls.filter(([file, command]) => file === "docker" && command !== "context"),
		prepare: (values: readonly string[]) => {
			tell("prepare the application's databases");
			engine.manager.prepareDatabases(values);
		},
		prepareTwice: () => {
			tell("prepare PostgreSQL again with an existing row");
			return prepareTwice(engine);
		},
		query: (query: string, connection = `${localServer}/postgres`) => engine.manager.sql(connection, query),
		queryAsNewRole: () => {
			tell("query through the container as a newly created role");
			return queryAsNewRole(engine);
		},
		selectClient: () => sqlInContainer(localDocker, new URL(`${localServer}/postgres`), [], { encoding: "utf8" }),
		start: (connection?: string) => {
			tell("start the local PostgreSQL service");
			engine.manager.startPostgres(connection);
		},
		startContainer: () => {
			tell("start the managed Docker container");
			startContainer(localDocker);
		},
		stop: (expectedProbes?: number) =>
			Effect.sync(() => {
				tell("stop the story and verify every expected Docker operation ran");
				engine.script?.done();
				if (expectedProbes !== undefined) {
					engine.startup?.done(expectedProbes);
				}
			}),
		verifyDocker: () => {
			tell("check the Docker daemon");
			return localDocker(["info"]);
		},
	};
}
