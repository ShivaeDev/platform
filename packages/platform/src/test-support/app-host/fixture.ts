import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { AuthUnavailable, Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import { Identity } from "#rpc/identity.ts";
import { Authenticated } from "#rpc/middleware.ts";
import type { SessionPolicy, SessionShape } from "#server/rpc-server/session.ts";

class Greeting extends Context.Service<Greeting, string>()("host-test/Greeting") {}
export const Api = RpcGroup.make(Rpc.make("greet", { error: Conflict, payload: { reject: Schema.Boolean }, success: Schema.String })).middleware(
	Authenticated,
);
export const handlers = Api.toLayer({
	greet: ({ reject }) =>
		Effect.gen(function* () {
			if (reject) {
				return yield* new Conflict({ field: "name", message: "Name is taken" });
			}
			return `${yield* Greeting}, ${(yield* Identity).id}`;
		}),
});

export function feature(table: string, lifecycle: string[]) {
	const loader = Migrator.fromRecord({
		"001_greeting": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table ${sql(table)} (greeting text not null)`;
			yield* sql`insert into ${sql(table)} values ('Hello')`;
		}),
	});
	const services = Layer.effect(
		Greeting,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ readonly greeting: string }>`select greeting from ${sql(table)}`;
			yield* Effect.acquireRelease(
				Effect.sync(() => lifecycle.push("started")),
				() => Effect.sync(() => lifecycle.push("closed")),
			);
			return rows[0]?.greeting ?? "Missing";
		}),
	);
	return { loader, services };
}

export function sessions(lookups: string[]): SessionPolicy<SessionShape> {
	return {
		origin: () => true,
		provider: {
			get: (headers) => {
				const token = headers.authorization ?? "";
				lookups.push(token);
				return token === "outage"
					? Effect.fail(new AuthUnavailable({ message: "Try later" }))
					: Effect.succeed(token === "" ? Option.none() : Option.some({ user: { id: token } }));
			},
		},
	};
}

export function call(url: string, token: string, reject = false, headers: Readonly<Record<string, string>> = {}) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ ...headers, authorization: token })),
		url: `${url}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcClient.make(Api);
			return yield* client.greet({ reject }).pipe(Effect.result);
		}).pipe(Effect.provide(protocol), Effect.scoped),
	);
}

export function post(url: string, headers: Readonly<Record<string, string>>) {
	return new Promise<number>((resolve, reject) => {
		const outgoing = request(`${url}/rpc`, { headers: { "content-type": "application/ndjson", ...headers }, method: "POST" }, (response) => {
			response.resume();
			response.on("end", () => resolve(response.statusCode ?? 0));
		});
		outgoing.on("error", reject);
		outgoing.end("{}\n");
	});
}

export async function staticAssets() {
	const path = await mkdtemp(join(tmpdir(), "host-assets-"));
	await writeFile(join(path, "index.html"), "<main>Hosted app</main>");
	return { close: () => rm(path, { force: true, recursive: true }), path };
}
