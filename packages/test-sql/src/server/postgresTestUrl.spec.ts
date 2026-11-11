import { expect } from "vitest";
import { databaseEnvironment, postgresGate } from "#test/postgresGate.ts";

for (const url of [undefined, ""]) {
	for (const ci of [undefined, ""]) {
		postgresGate.it(
			`a local kit with URL ${JSON.stringify(url)} and CI ${JSON.stringify(ci)} can skip PostgreSQL`,
			[databaseEnvironment(url, ci)],
			function* ({ collect }) {
				const result = yield* collect();
				expect(result.exitCode).toBe(0);
				expect(JSON.parse(result.output)).toEqual({ configured: false });
			},
		);
	}

	postgresGate.it(
		`CI refuses to collect a PostgreSQL kit with URL ${JSON.stringify(url)}`,
		[databaseEnvironment(url, "true")],
		function* ({ collect }) {
			const result = yield* collect();
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain("CI requires GATE_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
		},
	);
}

for (const ci of [undefined, "true"]) {
	postgresGate.it(
		`a configured kit with CI ${JSON.stringify(ci)} runs with its supplied URL`,
		[databaseEnvironment("postgresql://database.example/app_test", ci)],
		function* ({ collect }) {
			const result = yield* collect();
			expect(result.exitCode).toBe(0);
			expect(JSON.parse(result.output)).toEqual({ configured: true, url: "postgresql://database.example/app_test" });
		},
	);
}

for (const [name, database] of [
	["PLATFORM_SQL_TEST_DATABASE_URL", "platform_test_sql"],
	["PLATFORM_TEST_SQL_TEST_DATABASE_URL", "platform_test_test_sql"],
] as const) {
	postgresGate.it(
		`a local kit that reads ${name} without it set runs against ${database} on the local server`,
		[databaseEnvironment(undefined, undefined, name)],
		function* ({ collect }) {
			const result = yield* collect(name);
			expect(result.exitCode).toBe(0);
			expect(JSON.parse(result.output)).toEqual({ configured: true, url: `postgresql://postgres:postgres@127.0.0.1:55432/${database}` });
		},
	);

	postgresGate.it(
		`a supplied ${name} wins over the local database`,
		[databaseEnvironment("postgresql://database.example/app_test", undefined, name)],
		function* ({ collect }) {
			const result = yield* collect(name);
			expect(JSON.parse(result.output)).toEqual({ configured: true, url: "postgresql://database.example/app_test" });
		},
	);

	postgresGate.it(
		`CI still refuses to collect a kit that reads ${name} without it set`,
		[databaseEnvironment(undefined, "true", name)],
		function* ({ collect }) {
			const result = yield* collect(name);
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain(`CI requires ${name}; skipped PostgreSQL tests prove nothing.`);
		},
	);
}
