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
			expect(result.error).toContain("CI requires PLATFORM_GATE_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
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
