import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"prepares both databases and runs generated tests with the app environment on PostgreSQL",
	[],
	function* ({ cli, prepareDatabases, runDatabaseProbe, read }) {
		const name = `setup_${crypto.randomUUID().replaceAll("-", "")}`;
		expect((yield* cli([name, "--no-git"])).status).toBe(0);
		const setup = prepareDatabases();
		expect(setup.status, setup.stdout + setup.stderr).toBe(0);
		const test = runDatabaseProbe();
		expect(test.status, test.stdout + test.stderr).toBe(0);
		expect(JSON.parse(read("database-observations.json"))).toEqual({
			databases: {
				"DATABASE_URL": [{ name: `${name}_dev` }],
				"TEST_DATABASE_URL": [{ name: `${name}_test` }],
			},
			environment: {
				"DATABASE_URL": `postgresql://postgres:postgres@127.0.0.1:55432/${name}_dev`,
				"TEST_DATABASE_URL": `postgresql://postgres:postgres@127.0.0.1:55432/${name}_test`,
			},
			query: [{ value: 1 }],
		});
	},
);
