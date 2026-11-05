import { Cause, Deferred, Effect, Exit, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import createReceipts from "#server/migrations/0001_create_receipts.ts";
import { Receipt } from "#server/Receipt.ts";
import { webhookReceipts } from "#server/webhookReceipts.ts";
import { hostLayer, inboxState, startHost } from "#test/host.ts";
import { configured, postgresLayer } from "#test/postgresLayer.ts";

function startup(exit: Exit.Exit<unknown, unknown>) {
	if (Exit.isSuccess(exit)) {
		return "started";
	}
	const [error] = Cause.prettyErrors(exit.cause);
	return `refused to start: ${error?.message ?? Cause.pretty(exit.cause)}`;
}

export const schemaInbox = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => inboxState("check"),
	layer: postgresLayer,
	name: "webhook receipt migrations",
	runIf: configured,
	stages: ["database", "host"],
	verbs: (state, story) => ({
		applyReceipts: () => {
			story.tell("the deployment applies the webhook receipts component");
			return webhookReceipts({ schema: state.receiptsSchema }).apply;
		},
		host: () =>
			Effect.gen(function* () {
				if (state.url !== "") {
					return "started";
				}
				return (yield* Deferred.isDone(state.waiting)) ? `waiting for ${(yield* Deferred.await(state.waiting)).join(", ")}` : "not started";
			}),
		hostStart: () =>
			Effect.gen(function* () {
				if (state.host === undefined) {
					return yield* Effect.die(new Error("Declare hostWaitsForMigrations before reading its start"));
				}
				return startup(yield* Fiber.await(state.host));
			}),
		migrationPollIntervalPasses: () => {
			story.tell("one migration poll interval passes");
			return untilTimer("10 millis").pipe(Effect.andThen(passes("10 millis", Effect.void)));
		},
		pending: () => Effect.map(webhookReceipts({ schema: state.receiptsSchema }).pending, (pending) => pending ?? "nothing pending"),
		receiptJobIdsType: () => SqlClient.SqlClient.use((sql) => sql`select pg_typeof(job_ids)::text as type from webhook_receipts limit 1`),
		receipts: () =>
			SqlClient.SqlClient.use((sql) => sql`select * from webhook_receipts order by delivery_id`.withoutTransform).pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Receipt))),
			),
		startInCheckMode: () => {
			story.tell("the host starts in check mode");
			return Layer.build(hostLayer(state)).pipe(Effect.scoped, Effect.exit, Effect.map(startup));
		},
	}),
});

export const legacyReceipts = schemaInbox.trait("database", "receipts were recorded before the receipts migration ledger existed", function* () {
	yield* createReceipts();
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into webhook_receipts (source, delivery_id, event, received_at, outcome, job_ids) values
		('github', 'delivery-1', 'issues', '2026-10-01T12:00:00Z', 'queued', '["second-job", "first-job"]'::jsonb),
		('github', 'delivery-2', 'ping', '2026-10-01T12:00:01Z', 'ignored', '[]'::jsonb)`;
});

export const jobsSchemaInstalled = schemaInbox.trait(
	"database",
	"the pg-boss schema is installed, so only the receipts component can be pending",
	() => pgBossSchema().apply,
);

export const hostWaitsForMigrations = schemaInbox.trait("host", "a host in wait mode is waiting for database migrations", function* (state) {
	state.mode = "wait";
	state.host = yield* startHost(state).pipe(Effect.forkScoped);
	yield* Deferred.await(state.waiting);
});

export function schemaReceiptsIn(schema: string) {
	return schemaInbox.trait("database", `receipts belong to schema ${schema}`, (state) => {
		state.receiptsSchema = schema;
	});
}

export const defaultReceiptsInstalled = schemaInbox.trait(
	"database",
	"the default receipts and migration ledger already exist",
	() => webhookReceipts().apply,
);
