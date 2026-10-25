import { inspect } from "node:util";
import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { realPostgres } from "#test/postgresTraits.ts";

const PASSWORD = "query-failure-%+:@/password";
const USERINFO_PASSWORD = "ignored-userinfo-%+:@/password";
const QUERY_PASSWORD = "ignored-query-%+:@/password";
const credentials = [
	{ name: "userinfo", search: "", userinfo: PASSWORD },
	{ name: "query", search: `?password=${encodeURIComponent(PASSWORD)}`, userinfo: "" },
	{ name: "query overrides userinfo", search: `?password=${encodeURIComponent(PASSWORD)}`, userinfo: USERINFO_PASSWORD },
	{
		name: "last query wins",
		search: `?password=${encodeURIComponent(QUERY_PASSWORD)}&password=${encodeURIComponent(PASSWORD)}`,
		userinfo: USERINFO_PASSWORD,
	},
	{ name: "literal query plus", search: `?password=${encodeURIComponent(PASSWORD).replaceAll("%2B", "+")}`, userinfo: "" },
];

for (const { name, userinfo, search } of credentials) {
	for (const client of ["Docker", "host-psql"] as const) {
		postgres.it(
			`reports only PostgreSQL diagnostics without connection passwords using ${client} with ${name} credentials`,
			[realPostgres()],
			function* ({ createQueryRole, queryWithClient }) {
				const connection = yield* createQueryRole(PASSWORD);
				connection.password = encodeURIComponent(userinfo);
				connection.search = search;
				let failure: unknown;
				try {
					queryWithClient(client, connection, "SELECT 1 / 0");
				} catch (error) {
					failure = error;
				}
				expect(failure).toMatchObject({ cause: expect.any(Error), message: "ERROR:  division by zero\n" });
				const details = inspect(failure, { depth: null });
				for (const password of [PASSWORD, USERINFO_PASSWORD, QUERY_PASSWORD]) {
					expect(details).not.toContain(password);
					expect(details).not.toContain(encodeURIComponent(password));
					expect(details).not.toContain(encodeURIComponent(password).replaceAll("%2B", "+"));
				}
			},
		);
	}
}
