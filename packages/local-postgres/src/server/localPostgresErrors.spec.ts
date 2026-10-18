import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { expect, it } from "vitest";
import { sqlInContainer } from "#local-container.ts";
import { docker } from "#local-docker.ts";
import { localPostgres, localServer } from "#localPostgres.ts";

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

it.each(credentials.flatMap((credential) => ["Docker", "host-psql"].map((client) => ({ ...credential, client }))))(
	"reports only PostgreSQL diagnostics without connection passwords using $client with $name credentials",
	({ client, userinfo, search }) => {
		const postgres = localPostgres({});
		const role = `failure_${randomUUID().replaceAll("-", "")}`;
		postgres.sql(`${localServer}/postgres`, `CREATE ROLE "${role}" LOGIN PASSWORD '${PASSWORD}'`);
		try {
			const connection = new URL(`${localServer}/postgres`);
			connection.username = role;
			connection.password = encodeURIComponent(userinfo);
			connection.search = search;
			function query() {
				return client === "host-psql"
					? postgres.sql(connection, "SELECT 1 / 0")
					: sqlInContainer(
							(args, options) => docker({}, args, options),
							connection,
							["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", "SELECT 1 / 0"],
							{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
						);
			}
			let failure: unknown;
			try {
				query();
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
		} finally {
			postgres.sql(`${localServer}/postgres`, `DROP ROLE "${role}"`);
		}
	},
);
