import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Migrator, SqlClient } from "effect/sql";
import { readBoundedBody } from "@shivaedev/http/server/boundedBody.ts";
import { appHost } from "#appHost.ts";
import { databaseOf } from "./state.ts";
import { host, postgresHost } from "./story.ts";

class ExistingApi extends Context.Service<ExistingApi, (request: Request) => Promise<Response>>()("@shivaedev/server/test/ExistingApi") {}

const routes = HttpRouter.add("*", "/rpc", () =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const body = request.method === "POST" ? yield* readBoundedBody() : undefined;
		const web = yield* HttpServerRequest.toWeb(request);
		const handle = yield* ExistingApi;
		const response = yield* Effect.promise(() => handle(body === undefined ? web : new Request(web, { body })));
		return HttpServerResponse.fromWeb(response);
	}),
);

function services<R>(lifecycle: string[], calls: (string | Buffer)[], greeting: Effect.Effect<string, never, R>) {
	return Layer.effect(
		ExistingApi,
		Effect.gen(function* () {
			const prefix = yield* greeting;
			yield* Effect.acquireRelease(
				Effect.sync(() => lifecycle.push("acquired")),
				() => Effect.sync(() => lifecycle.push("released")),
			);
			return async (request) => {
				const body = await request.text();
				calls.push(body);
				return new Response(`${prefix}: ${body}`, { headers: { "access-control-allow-origin": "*" } });
			};
		}),
	);
}

export const existingApi = host.trait("configured", "the app keeps its existing Web request handler without native RPC", (state) => {
	state.build = () =>
		appHost({
			config: state.config,
			routes,
			services: services(state.lifecycle, state.calls, Effect.succeed("Existing API")),
		});
});

export function migratedExistingApi(deferred = false) {
	return postgresHost.trait("configured", "the existing API starts after PostgreSQL migrations", (state) => {
		const config = { ...state.config, databaseUrl: databaseOf(state).url };
		const migrations = {
			loader: Migrator.fromRecord({
				"001_greeting": SqlClient.SqlClient.use((sql) => sql`create table api_greetings as select 'Migrated API'::text as greeting`),
			}),
		};
		const greeting = SqlClient.SqlClient.use((sql) => sql<{ greeting: string }>`select greeting from api_greetings`).pipe(
			Effect.map((rows) => rows[0]?.greeting ?? "missing migration"),
			Effect.orDie,
		);
		state.build = () => {
			const options = { config, routes, services: services(state.lifecycle, state.calls, greeting) };
			return deferred ? appHost({ application: Effect.succeed(options), config, migrations }) : appHost({ ...options, migrations });
		};
	});
}
