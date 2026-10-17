import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { dockerEndpoint, realPostgres } from "#test/postgresTraits.ts";

postgres.it("rejects remote, mismatched and redirected local targets", [], function* ({ assertDatabase, databaseUrl, stop }) {
	const name = "platform_test_local_postgres";
	const url = databaseUrl(name);
	expect(assertDatabase(url, [name]).pathname).toBe(`/${name}`);
	for (const value of [
		url.replace("127.0.0.1", "example.com"),
		url.replace("55432", "5432"),
		databaseUrl("platform_dev"),
		`${url}?host=example.com`,
	]) {
		expect(() => assertDatabase(value, [name])).toThrow("Use a local database");
	}
	yield* stop();
});

for (const host of ["ssh://example.com", "tcp://example.com:2376"]) {
	postgres.it(
		`refuses remote Docker endpoint ${host} before issuing a Docker operation`,
		[dockerEndpoint(host)],
		function* ({ verifyDocker, operations, stop }) {
			expect(verifyDocker).toThrow("remote contexts are refused");
			expect(operations()).toEqual([]);
			yield* stop();
		},
	);
}

postgres.it("rejects remote preparation and query targets before connecting", [], function* ({ start, prepare, query, stop }) {
	const remote = "postgresql://postgres:postgres@example.com:55432/example_test";
	expect(() => start(remote)).toThrow("Use a local database");
	expect(() => prepare([remote])).toThrow("Use a local database");
	expect(() => query("SELECT 1", remote)).toThrow("Use a local database");
	yield* stop();
});

postgres.it("rejects malformed database identifiers before preparing PostgreSQL", [], function* ({ prepare, databaseUrl, stop }) {
	for (const name of ["", "1starts_with_number", "has-hyphens", "Uppercase", "a".repeat(64), "name%27%3Bselect"]) {
		expect(() => prepare([databaseUrl(name)])).toThrow("Invalid local database name.");
	}
	yield* stop();
});

postgres.it(
	"preserves PostgreSQL's specific query error instead of replacing it with a generic failure",
	[realPostgres()],
	function* ({ query, stop }) {
		expect(() => query("SELECT 1 / 0")).toThrow("ERROR:  division by zero");
		yield* stop();
	},
);

postgres.it(
	"reports an invalid explicit connection timeout instead of silently replacing it",
	[realPostgres()],
	function* ({ query, databaseUrl, stop }) {
		expect(() => query("SHOW server_version", `${databaseUrl("postgres")}?connect_timeout=invalid`)).toThrow(
			'invalid integer value "invalid" for connection option "connect_timeout"',
		);
		yield* stop();
	},
);

postgres.it(
	"uses the supplied database credentials when the container supplies the real PostgreSQL client",
	[realPostgres()],
	function* ({ queryAsNewRole, stop }) {
		const { result, role } = queryAsNewRole();
		expect(result).toBe(`${role}|postgres`);
		yield* stop();
	},
);

postgres.it.fails(
	"reports only PostgreSQL diagnostics without the connection password when using the Docker client",
	[realPostgres()],
	function* ({ containerQuery, stop }) {
		expect(() => containerQuery("SELECT 1 / 0")).toThrow(new Error("ERROR:  division by zero\n"));
		yield* stop();
	},
);

postgres.it("prepares real PostgreSQL repeatedly without removing existing data", [realPostgres()], function* ({ prepareTwice, stop }) {
	expect(prepareTwice()).toEqual({ value: "preserved", version: "18.6" });
	yield* stop();
});
