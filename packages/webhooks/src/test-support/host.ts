import { ConfigProvider, Context, Effect, Layer, Logger, Redacted, Tracer } from "effect";
import { HttpServer } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { PgBoss } from "pg-boss";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { webhookRoute } from "#route.ts";
import { auditQueue, issueQueue, Jobs, sources, WEBHOOK_SECRET } from "#test/fixture.ts";
import { webhookReceipts } from "#webhookReceipts.ts";

export interface InboxState {
	client: PgBoss | undefined;
	readonly logs: unknown[];
	mode: "check" | "wait" | undefined;
	readonly telemetry: { readonly spans: Tracer.NativeSpan[]; readonly tracer: Tracer.Tracer };
	url: string;
}

export function hostLayer(state: InboxState) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const { url } = yield* PostgresTestDatabase;
			return appHost({
				application: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const client = new PgBoss({ connectionString: Redacted.value(url), migrate: false, schedule: false, supervise: false });
					state.client = client;
					const jobs = Jobs.layer({
						clientFactory: () => client,
						connectionString: Redacted.value(url),
						jobs: [issueQueue, auditQueue],
						migrate: false,
						schedule: false,
						supervise: false,
					});
					return {
						config: { maxBodySize: 256, port: 0 },
						group: RpcGroup.make(),
						handlers: Layer.empty,
						policy: "loopback" as const,
						routes: webhookRoute({ basePath: "/hooks", jobs: Jobs, sources }).pipe(
							Layer.provide(jobs),
							Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)),
							Layer.orDie,
						),
						services: jobs,
					};
				}),
				config: { databaseUrl: url },
				migrations: {
					components: [pgBossSchema(), webhookReceipts],
					loader: Migrator.fromRecord({}),
					...(state.mode === undefined ? {} : { mode: state.mode }),
					...(state.mode === "wait" ? { pollInterval: "10 millis" } : {}),
				},
			}).pipe(
				Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "WEBHOOK_SECRET": WEBHOOK_SECRET } }))),
				Layer.provide(Layer.succeed(Tracer.Tracer, state.telemetry.tracer)),
				Layer.provide(Logger.layer([Logger.make(({ message }) => state.logs.push(message))])),
			);
		}),
	);
}

export const startHost = Effect.fnUntraced(function* (state: InboxState) {
	const services = yield* Layer.build(hostLayer(state));
	state.url = HttpServer.formatAddress(Context.get(services, HttpServer.HttpServer).address);
});
