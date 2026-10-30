import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { databasesPrepared, generatedWithOwnDatabases } from "#test/traits.ts";

application.it(
	"the generated app's tests read both database URLs from .env.local, reach both prepared databases and query PostgreSQL through the app's test layer",
	[generatedWithOwnDatabases("--no-git"), databasesPrepared],
	function* ({ databaseObservation, runDatabaseProbe }) {
		yield* runDatabaseProbe();

		yield* outcomes({
			"databases the URLs reach": [
				databaseObservation("databases"),
				{ "DATABASE_URL": [{ name: "{app}_dev" }], "TEST_DATABASE_URL": [{ name: "{app}_test" }] },
			],
			"query through the app's test layer": [databaseObservation("query"), [{ value: 1 }]],
			"URLs the test reads": [
				databaseObservation("environment"),
				{
					"DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:55432/{app}_dev",
					"TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:55432/{app}_test",
				},
			],
		});
	},
);
