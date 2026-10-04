import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { assertLocalDatabase, localPostgres, localServer } from "#index.ts";
import { docker } from "#local-docker.ts";

it("rejects remote, mismatched and redirected local targets", () => {
	const name = "platform_test_local_postgres";
	const url = `${localServer}/${name}`;
	expect(assertLocalDatabase(url, [name]).pathname).toBe(`/${name}`);
	for (const value of [
		url.replace("127.0.0.1", "example.com"),
		url.replace("55432", "5432"),
		`${localServer}/platform_dev`,
		`${url}?host=example.com`,
	]) {
		expect(() => assertLocalDatabase(value, [name])).toThrow("Use a local database");
	}
});

it("refuses remote Docker endpoints before issuing a Docker operation", () => {
	for (const host of ["ssh://example.com", "tcp://example.com:2376"]) {
		expect(() => docker({ DOCKER_HOST: host }, ["info"])).toThrow("remote contexts are refused");
	}
});

it("rejects remote preparation and query targets before connecting", () => {
	const postgres = localPostgres({});
	const remote = "postgresql://postgres:postgres@example.com:55432/example_test";
	expect(() => postgres.startPostgres(remote)).toThrow("Use a local database");
	expect(() => postgres.prepareDatabases([remote])).toThrow("Use a local database");
	expect(() => postgres.sql(remote, "SELECT 1")).toThrow("Use a local database");
});

it("prepares real PostgreSQL repeatedly without removing existing data", () => {
	const url = `${localServer}/platform_test_local_postgres`;
	assertLocalDatabase(url, ["platform_test_local_postgres"]);
	const postgres = localPostgres({});
	postgres.prepareDatabases([url]);
	const table = `setup_preservation_${randomUUID().replaceAll("-", "")}`;
	postgres.sql(url, `CREATE TABLE "${table}" (value text NOT NULL)`);
	try {
		postgres.sql(url, `INSERT INTO "${table}" VALUES ('preserved')`);
		postgres.prepareDatabases([url]);
		expect(postgres.sql(url, `SELECT value FROM "${table}"`)).toBe("preserved");
		expect(postgres.sql(`${url}?schema=public&connection_limit=1`, "SHOW server_version")).toBe("18.6");
	} finally {
		postgres.sql(url, `DROP TABLE "${table}"`);
	}
});
