import { Config, Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startHost } from "./host.ts";
import { oauthVerbs } from "./oauthVerbs.ts";

const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Effect.runSync(
		Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL").pipe(
			Config.withDefault(Redacted.make("postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql")),
		),
	),
});
export const mcp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => startHost,
	inspect: ({ resource }) => ({ resource }),
	layer: postgres,
	name: "MCP on the application host",
	stages: [],
	verbs: (host, story) => ({
		...oauthVerbs(host, story.tell),
		baseUrl: host.baseUrl,
		get: (path: string) => Effect.promise(async () => (await fetch(new URL(path, host.baseUrl))).json()),
		request: (method: string, params: Record<string, unknown> = {}, token?: string) =>
			Effect.promise(async () => {
				story.tell(`the client sends ${method}`);
				const response = await fetch(host.resource, {
					body: JSON.stringify({
						id: 1,
						jsonrpc: "2.0",
						method,
						params: {
							...params,
							_meta: { "io.modelcontextprotocol/clientCapabilities": {}, "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
						},
					}),
					headers: {
						accept: "application/json, text/event-stream",
						"content-type": "application/json",
						"mcp-method": method,
						"mcp-protocol-version": "2026-07-28",
						...(typeof params.name === "string" ? { "mcp-name": params.name } : {}),
						...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
					},
					method: "POST",
				});
				return { body: await response.text(), challenge: response.headers.get("www-authenticate"), status: response.status };
			}),
		resource: host.resource,
	}),
});
