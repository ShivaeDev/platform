import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { sqlInContainer } from "#local-container.ts";
import { docker } from "#local-docker.ts";
import { assertLocalDatabase, localPostgres, localServer } from "#localPostgres.ts";

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
		expect(() => docker({ "DOCKER_HOST": host }, ["info"])).toThrow("remote contexts are refused");
	}
});

it("rejects remote preparation and query targets before connecting", () => {
	const postgres = localPostgres({});
	const remote = "postgresql://postgres:postgres@example.com:55432/example_test";
	expect(() => postgres.startPostgres(remote)).toThrow("Use a local database");
	expect(() => postgres.prepareDatabases([remote])).toThrow("Use a local database");
	expect(() => postgres.sql(remote, "SELECT 1")).toThrow("Use a local database");
});

it("rejects malformed database identifiers before preparing PostgreSQL", () => {
	const postgres = localPostgres({});
	for (const name of ["", "1starts_with_number", "has-hyphens", "Uppercase", "a".repeat(64), "name%27%3Bselect"]) {
		expect(() => postgres.prepareDatabases([`${localServer}/${name}`])).toThrow("Invalid local database name.");
	}
});

it("preserves PostgreSQL's specific query error instead of replacing it with a generic failure", () => {
	const postgres = localPostgres({});
	expect(() => postgres.sql(`${localServer}/postgres`, "SELECT 1 / 0")).toThrow("ERROR:  division by zero");
});

it("reports an invalid explicit connection timeout instead of silently replacing it", () => {
	const postgres = localPostgres({});
	expect(() => postgres.sql(`${localServer}/postgres?connect_timeout=invalid`, "SHOW server_version")).toThrow(
		'invalid integer value "invalid" for connection option "connect_timeout"',
	);
});

it("uses the supplied database credentials when the container supplies the real PostgreSQL client", () => {
	const postgres = localPostgres({});
	const role = `client_${randomUUID().replaceAll("-", "")}`;
	const password = "local-client-fixture-password";
	postgres.sql(`${localServer}/postgres`, `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
	try {
		const connection = new URL(`${localServer}/postgres`);
		connection.username = role;
		connection.password = password;
		expect(
			sqlInContainer(
				(args, options) => docker({}, args, options),
				connection,
				["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", "SELECT session_user, current_database()"],
				{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
			),
		).toBe(`${role}|postgres`);
	} finally {
		postgres.sql(`${localServer}/postgres`, `DROP ROLE "${role}"`);
	}
});

it.fails("reports only PostgreSQL diagnostics without the connection password when using the Docker client", () => {
	expect(() =>
		sqlInContainer(
			(args, options) => docker({}, args, options),
			new URL(`${localServer}/postgres`),
			["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", "SELECT 1 / 0"],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		),
	).toThrow(new Error("ERROR:  division by zero\n"));
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
