import { Context, Effect, Layer, Option, Tracer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SqlClient } from "effect/sql";
import { defaultClientFactory, type PgBossClient } from "@shivaedev/jobs/server/client.ts";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { Api } from "./Api.ts";
import { Jobs, Work } from "./feature.ts";

export const openHost = Effect.fnUntraced(function* (tracer: Tracer.Tracer) {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	const headers: string[] = [];
	const handlers = Api.toLayer({
		write: ({ id }, options) =>
			Effect.gen(function* () {
				headers.push(options.headers.traceparent ?? "missing");
				yield* sql`insert into actions values (${id})`;
				const jobs = yield* Jobs;
				return Option.getOrThrow(yield* jobs.enqueue(Work, { id }).pipe(Effect.withSpan("Action.enqueue", { kind: "producer" })));
			}).pipe(Effect.orDie),
	});
	let client: PgBossClient | undefined;
	const services = Jobs.layer({ jobs: [Work] }).pipe(
		Layer.provide(
			pgBossLayer({
				clientFactory: (options) => {
					client = defaultClientFactory(options);
					return client;
				},
				connectionString: database.url,
			}),
		),
	);
	const context = yield* Layer.build(
		appHost({ config: { port: 0 }, group: Api, handlers, policy: "loopback", services }).pipe(Layer.provide(Layer.succeed(Tracer.Tracer, tracer))),
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("Expected TCP host"));
	}
	return {
		headers,
		stored: () =>
			Effect.promise(async () => {
				if (!client?.findJobs) {
					throw new Error("Missing native job reader");
				}
				return (await client.findJobs(Work.name)).map((job) => job.data);
			}),
		url: `http://127.0.0.1:${server.address.port}/rpc`,
	};
});
