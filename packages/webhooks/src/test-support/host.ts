import { Cause, ConfigProvider, Context, Deferred, Effect, type Fiber, Layer, Logger, Redacted, References, Tracer } from "effect";
import { HttpServer } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { makePgBossTesting, type PgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { webhookRoute } from "#route.ts";
import { auditQueue, issueQueue, Jobs, MAX_BODY_BYTES, sources, WEBHOOK_SECRET } from "#test/fixture.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { webhookReceipts } from "#webhookReceipts.ts";

export interface HandledJob {
	readonly id: string;
	readonly issue: number;
	readonly queue: string;
}

export interface Sent {
	readonly body: string;
	readonly signature: string | null;
}

export interface InboxState {
	readonly answers: string[];
	firstReceiptUpdateFails: boolean;
	readonly handled: HandledJob[];
	host: Fiber.Fiber<void, unknown> | undefined;
	readonly logs: Array<{ readonly annotations: unknown; readonly cause: string; readonly message: unknown }>;
	mode: "check" | "wait" | undefined;
	readonly sent: Sent[];
	readonly telemetry: ReturnType<typeof recordingTracer>;
	testing: PgBossTesting | undefined;
	url: string;
	readonly waiting: Deferred.Deferred<readonly string[]>;
}

export function inboxState(mode: InboxState["mode"]): InboxState {
	return {
		answers: [],
		firstReceiptUpdateFails: false,
		handled: [],
		host: undefined,
		logs: [],
		mode,
		sent: [],
		telemetry: recordingTracer(),
		testing: undefined,
		url: "",
		waiting: Deferred.makeUnsafe(),
	};
}

function pendingNames(annotations: Readonly<Record<string, unknown>>) {
	const pending = annotations.pendingComponents;
	return Array.isArray(pending) ? pending.map((component: { readonly name?: unknown }) => String(component.name)) : [];
}

function hostLogger(state: InboxState) {
	return Logger.make(({ cause, fiber, message }) => {
		const annotations = fiber.getRef(References.CurrentLogAnnotations);
		state.logs.push({ annotations, cause: Cause.pretty(cause), message });
		if (JSON.stringify(message).includes("Waiting for database migrations")) {
			Deferred.doneUnsafe(state.waiting, Effect.succeed(pendingNames(annotations)));
		}
	});
}

function recordHandled(state: InboxState, queue: string) {
	return ({ number }: { readonly number: number }, job: { readonly id: string }) =>
		Effect.sync(() => {
			state.handled.push({ id: job.id, issue: number, queue });
		});
}

export function hostLayer(state: InboxState) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const { url } = yield* PostgresTestDatabase;
			return appHost({
				application: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const testing = makePgBossTesting();
					state.testing = testing;
					const jobs = Jobs.layer({
						clientFactory: testing.clientFactory,
						connectionString: Redacted.value(url),
						jobs: [issueQueue.handle(recordHandled(state, issueQueue.name)), auditQueue.handle(recordHandled(state, auditQueue.name))],
						migrate: false,
						schedule: false,
						supervise: false,
						useListenNotify: true,
					});
					return {
						config: { maxBodySize: MAX_BODY_BYTES, port: 0 },
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
				Layer.provide(Logger.layer([hostLogger(state)])),
			);
		}),
	);
}

export const startHost = Effect.fnUntraced(function* (state: InboxState) {
	const services = yield* Layer.build(hostLayer(state));
	state.url = HttpServer.formatAddress(Context.get(services, HttpServer.HttpServer).address);
});
