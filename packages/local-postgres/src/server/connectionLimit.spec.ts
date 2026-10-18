import { Effect } from "effect";
import { expect } from "vitest";
import { PostgresSettingError } from "#localConnections.ts";
import { connections, stockContainer } from "#test/connections.ts";

connections.it("starts a fresh container with 500 connections", [], function* ({ start, execute, containerId }) {
	yield* start();
	expect(containerId()).toMatch(/^[a-f0-9]{64}$/u);
	expect(execute("SHOW max_connections")).toBe("500");
});

connections.it(
	"raises a running stock container to 500 without replacing it or losing data",
	[stockContainer()],
	function* ({ start, execute, containerId, startedAt }) {
		expect(execute("SHOW max_connections")).toBe("100");
		execute("CREATE TABLE preserved (value text); INSERT INTO preserved VALUES ('existing data')");
		const id = containerId();
		const before = startedAt();
		yield* start();
		expect(execute("SHOW max_connections")).toBe("500");
		expect(execute("SELECT value FROM preserved")).toBe("existing data");
		expect(containerId()).toBe(id);
		expect(startedAt()).not.toBe(before);
		const after = startedAt();
		const settings = execute("SELECT setting, applied FROM pg_file_settings WHERE name = 'max_connections' ORDER BY sourcefile, sourceline");
		yield* start();
		expect(startedAt()).toBe(after);
		expect(execute("SELECT setting, applied FROM pg_file_settings WHERE name = 'max_connections' ORDER BY sourcefile, sourceline")).toBe(settings);
		expect(execute("SELECT value FROM preserved")).toBe("existing data");
	},
);

connections.it(
	"leaves a higher connection limit and the running container unchanged",
	[stockContainer(600)],
	function* ({ start, execute, startedAt }) {
		const before = startedAt();
		const settings = execute("SELECT setting, applied FROM pg_file_settings WHERE name = 'max_connections' ORDER BY sourcefile, sourceline");
		yield* start();
		expect(execute("SHOW max_connections")).toBe("600");
		expect(startedAt()).toBe(before);
		expect(execute("SELECT setting, applied FROM pg_file_settings WHERE name = 'max_connections' ORDER BY sourcefile, sourceline")).toBe(settings);
	},
);

connections.it("reports a typed setting error when PostgreSQL refuses the change", [stockContainer()], function* ({ start, execute, startedAt }) {
	execute("CREATE ROLE unprivileged LOGIN PASSWORD 'local-test'");
	const before = startedAt();
	const failure = yield* Effect.flip(start("postgresql://unprivileged:local-test@127.0.0.1:55432/postgres"));
	expect(failure).toBeInstanceOf(PostgresSettingError);
	expect(failure).toMatchObject({
		_tag: "PostgresSettingError",
		cause: expect.any(Error),
		container: "development-postgres",
		setting: "max_connections",
	});
	expect(String(failure)).toContain("development-postgres");
	expect(String(failure)).toContain("max_connections");
	expect(execute("SHOW max_connections")).toBe("100");
	expect(startedAt()).toBe(before);
});
