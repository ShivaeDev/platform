import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { dockerEndpoint, realPostgres } from "#test/postgresTraits.ts";

postgres.it("rejects remote, mismatched and redirected local targets", [], ({ assertDatabase, databaseUrl }) => {
	const name = "platform_test_local_postgres";
	const url = databaseUrl(name);
	expect(assertDatabase(url, [name]).pathname).toBe(`/${name}`);
	for (const value of [
		url.replace("127.0.0.1", "example.com"),
		url.replace("55432", "5432"),
		databaseUrl("platform_dev"),
		...["host", "hostaddr", "port", "dbname", "service"].map((key) => `${url}?${key}=redirected`),
	]) {
		expect(() => assertDatabase(value, [name])).toThrow("Use a local database");
	}
});

for (const host of ["ssh://example.com", "tcp://example.com:2376"]) {
	postgres.it(`refuses remote Docker endpoint ${host} before issuing a Docker operation`, [dockerEndpoint(host)], ({ verifyDocker, operations }) => {
		expect(verifyDocker).toThrow("remote contexts are refused");
		expect(operations()).toEqual([]);
	});
}

for (const target of [
	{ host: "example.com", name: "a remote host", port: "55432", suffix: "" },
	{ host: "127.0.0.1", name: "the wrong port", port: "5432", suffix: "" },
	...["host", "hostaddr", "port", "dbname", "service"].map((key) => ({
		host: "127.0.0.1",
		name: `the ${key} redirecting parameter`,
		port: "55432",
		suffix: `?${key}=redirected`,
	})),
]) {
	postgres.it(
		`rejects ${target.name} in preparation and queries before connecting`,
		[],
		({ start, prepare, query, databaseUrl, subprocessCalls }) => {
			const value = `postgresql://postgres:postgres@${target.host}:${target.port}/example_test${target.suffix}`;
			expect(() => prepare([value])).toThrow("Use a local database");
			expect(() => prepare([databaseUrl("example_dev"), value])).toThrow("Use a local database");
			expect(() => start(value)).toThrow("Use a local database");
			expect(() => query("SELECT 1", value)).toThrow("Use a local database");
			expect(subprocessCalls()).toEqual([]);
		},
	);
}

postgres.it("rejects malformed database identifiers before preparing PostgreSQL", [], ({ prepare, databaseUrl }) => {
	for (const name of ["", "1starts_with_number", "has-hyphens", "Uppercase", "a".repeat(64), "name%27%3Bselect"]) {
		expect(() => prepare([databaseUrl(name)])).toThrow("Invalid local database name.");
	}
});

postgres.it("preserves PostgreSQL's specific query error instead of replacing it with a generic failure", [realPostgres()], ({ query }) => {
	expect(() => query("SELECT 1 / 0")).toThrow("ERROR:  division by zero");
});

postgres.it("reports an invalid explicit connection timeout instead of silently replacing it", [realPostgres()], ({ query, databaseUrl }) => {
	expect(() => query("SHOW server_version", `${databaseUrl("postgres")}?connect_timeout=invalid`)).toThrow(
		'invalid integer value "invalid" for connection option "connect_timeout"',
	);
});

postgres.it(
	"uses the supplied database credentials when the container supplies the real PostgreSQL client",
	[realPostgres()],
	({ queryAsNewRole }) => {
		const { result, role } = queryAsNewRole();
		expect(result).toBe(`${role}|postgres`);
	},
);

postgres.it(
	"reports only PostgreSQL diagnostics without the connection password when using the Docker client",
	[realPostgres()],
	({ containerQuery }) => {
		expect(() => containerQuery("SELECT 1 / 0")).toThrow(new Error("ERROR:  division by zero\n"));
	},
);

postgres.it("prepares real PostgreSQL repeatedly without removing existing data", [realPostgres()], ({ prepareTwice }) => {
	expect(prepareTwice()).toEqual({ value: "preserved", version: "18.6" });
});
