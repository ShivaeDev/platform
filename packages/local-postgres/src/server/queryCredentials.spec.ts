import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { credentialForms } from "#test/credentials.ts";
import { queryRole } from "#test/databaseTraits.ts";
import { postgres } from "#test/postgres.ts";
import { realPostgres, realPostgresWithoutHostPsql } from "#test/postgresTraits.ts";

for (const [client, given, command] of [
	["host psql", realPostgres(), "the failed psql command"],
	["the container's psql", realPostgresWithoutHostPsql(), "the failed docker exec command"],
] as const) {
	for (const credentials of credentialForms) {
		postgres.it(`${client} signs in as the query role with ${credentials.name}`, [given, queryRole()], function* ({ connectWith, outcome }) {
			yield* connectWith(credentials);

			expect(yield* outcome()).toBe("the query role on postgres");
		});

		postgres.it(
			`with ${credentials.name}, a query through ${client} that PostgreSQL rejects fails with its diagnostic, names the failed command and shows no password`,
			[given, queryRole()],
			function* ({ failedCommand, outcome, passwordsInFailure, queryWith }) {
				yield* queryWith(credentials, "SELECT 1 / 0");

				yield* outcomes({
					"command": [failedCommand(), command],
					"passwords shown": [passwordsInFailure(), []],
					"query": [outcome(), "failed: ERROR:  division by zero"],
				});
			},
		);
	}
}
