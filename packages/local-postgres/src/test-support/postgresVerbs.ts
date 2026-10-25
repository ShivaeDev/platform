import { sqlInContainer, startContainer } from "#localContainer.ts";
import { docker } from "#localDocker.ts";
import { assertLocalDatabase, LOCAL_SERVER } from "#localPostgres.ts";
import type { PostgresEngine } from "#test/postgresEngine.ts";
import { createQueryRole, queryWithClient } from "#test/queryCredentials.ts";
import { containerQuery, prepareTwice, queryAsNewRole } from "#test/realPostgres.ts";

export function postgresVerbs(engine: PostgresEngine, tell: (line: string) => void) {
	function localDocker(args: readonly string[]) {
		return docker(engine.environment, args);
	}
	return {
		assertDatabase: (value: string, names: readonly string[]) => assertLocalDatabase(value, names),
		containerQuery: (query: string) => containerQuery(engine, new URL(`${LOCAL_SERVER}/postgres`), query),
		contextInspections: () => engine.calls.filter(([file, command]) => file === "docker" && command === "context"),
		createQueryRole: (password: string) => createQueryRole(engine, password),
		databaseUrl: (name: string) => `${LOCAL_SERVER}/${name}`,
		discoveryProbes: () => engine.startup?.probes(),
		operations: () => engine.calls.filter(([file, command]) => file === "docker" && command !== "context"),
		prepare: (values: readonly string[]) => {
			tell("prepare the application's databases");
			engine.manager.prepareDatabases(values);
		},
		prepareTwice: () => {
			tell("prepare PostgreSQL again with an existing row");
			return prepareTwice(engine);
		},
		query: (query: string, connection = `${LOCAL_SERVER}/postgres`) => engine.manager.sql(connection, query),
		queryAsNewRole: () => {
			tell("query through the container as a newly created role");
			return queryAsNewRole(engine);
		},
		queryWithClient: (client: "Docker" | "host-psql", connection: URL, query: string) => queryWithClient(engine, client, connection, query),
		selectClient: () => sqlInContainer(localDocker, new URL(`${LOCAL_SERVER}/postgres`), [], { encoding: "utf8" }),
		start: (connection?: string) => {
			tell("start the local PostgreSQL service");
			engine.manager.startPostgres(connection);
		},
		startContainer: () => {
			tell("start the managed Docker container");
			startContainer(localDocker);
		},
		subprocessCalls: () => engine.calls,
		subprocessEncodings: () => engine.encodings,
		verifyDocker: () => {
			tell("check the Docker daemon");
			return localDocker(["info"]);
		},
	};
}
