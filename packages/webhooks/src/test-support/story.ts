import { Clock, DateTime, Deferred, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Receipt } from "#server/Receipt.ts";
import { auditQueue } from "#test/fixture.ts";
import { type HandledJob, type InboxState, inboxState, startHost } from "#test/host.ts";
import { configured, postgresLayer } from "#test/postgresLayer.ts";
import { collectTelemetry, privacyVerbs } from "#test/privacy.ts";
import { raceVerbs } from "#test/raceVerbs.ts";
import { type Delivery, deliver } from "#test/requests.ts";
import { resourceVerbs } from "#test/resourceVerbs.ts";
import { requestOutcomes, secretsSeenIn, spanNames } from "#test/telemetry.ts";

function testingOf(state: InboxState) {
	return state.testing === undefined ? Effect.die(new Error("The host has not started its jobs client")) : Effect.succeed(state.testing);
}

function workersIdle(state: InboxState) {
	return Effect.flatMap(testingOf(state), (testing) => testing.waitForIdle).pipe(Effect.orDie);
}

function jobName({ issue, queue }: HandledJob) {
	return `${queue} for issue ${issue}`;
}

function receiptJobName(state: InboxState, id: string) {
	const job = state.handled.find((handled) => handled.id === id);
	return job === undefined ? "a job no worker handled" : jobName(job);
}

export const inbox = storyKit({
	after: { host: startHost },
	around: withIsolatedDatabase,
	clock: DateTime.makeUnsafe("2026-10-01T12:00:00Z"),
	create: () => inboxState(undefined),
	inspect: ({ answers, handled }) => ({ answers, handled }),
	layer: postgresLayer,
	name: "webhook inbox",
	runIf: configured,
	stages: ["host", "inbox"],
	verbs: (state, story) => ({
		...privacyVerbs(state),
		...raceVerbs(state, story.tell),
		...resourceVerbs(state, story.tell),
		answer: () => Effect.sync(() => state.answers.at(-1) ?? "no answer yet"),
		answers: () => Effect.sync(() => state.answers.toSorted()),
		deliver: (delivery: Delivery) => {
			story.tell(`github sends ${delivery}`);
			return deliver(state, delivery);
		},
		deliveryJobs: () => Effect.map(workersIdle(state), () => [...state.deliveries]),
		errorLogs: () => Effect.sync(() => state.logs.filter(({ level }) => level === "Error")),
		handledJobs: () => Effect.map(workersIdle(state), () => state.handled.map(jobName).toSorted()),
		requestOutcomes: () => Effect.sync(() => requestOutcomes(state)),
		secretsSeenIn: () => Effect.sync(() => secretsSeenIn(state)),
		spanNames: () => Effect.sync(() => spanNames(state)),
		storedReceipts: () =>
			Effect.gen(function* () {
				yield* workersIdle(state);
				const rows = yield* SqlClient.SqlClient.use(
					(sql) =>
						sql`select * from ${sql(state.receiptsSchema === undefined ? "webhook_receipts" : `${state.receiptsSchema}.webhook_receipts`)} order by source, delivery_id`
							.withoutTransform,
				).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Receipt))));
				return rows.map((row) => ({
					delivery: row.deliveryId,
					event: row.event,
					jobs: row.jobIds.map((id) => receiptJobName(state, id)).toSorted(),
					outcome: row.outcome,
					source: row.source,
				}));
			}),
		storedReceiptTables: () =>
			SqlClient.SqlClient.use((sql) =>
				sql<{ name: string }>`select n.nspname || '.' || c.relname as name from pg_class c
				join pg_namespace n on n.oid = c.relnamespace
				where c.relname in ('webhook_receipts', 'webhook_receipts_migrations') order by name`.pipe(
					Effect.map((rows) => rows.map(({ name }) => name)),
				),
			),
	}),
});

export const telemetryCollector = inbox.trait("host", "an OTLP collector receives exported host telemetry", collectTelemetry);

export function delivered(delivery: Delivery) {
	return inbox.trait("inbox", `github has already sent ${delivery}`, (state) => deliver(state, delivery));
}

export const auditEnqueueFails = inbox.trait("inbox", "the next webhook-audit enqueue fails", (state) =>
	Effect.flatMap(testingOf(state), (testing) => testing.failNextSend(auditQueue)),
);

export const receiptsTableGone = inbox.trait("inbox", "the database can no longer find the webhook_receipts table", () =>
	SqlClient.SqlClient.use((sql) => sql`alter table webhook_receipts rename to webhook_receipts_gone`),
);

export const firstReceiptUpdateFails = inbox.trait("inbox", "the first copy to update its receipt fails", (state) => {
	state.firstReceiptUpdateFails = true;
});

export function senderOptIn(expiry: "future" | "past") {
	return inbox.trait("inbox", `the sender's opt-in expires in the ${expiry}`, function* () {
		const sql = yield* SqlClient.SqlClient;
		const now = yield* Clock.currentTimeMillis;
		yield* sql`create table webhook_senders (sender text primary key, allowed_until timestamptz not null)`;
		yield* sql`insert into webhook_senders values ('alice', to_timestamp(${now} / 1000.0) + ${expiry === "future" ? "1 day" : "-1 day"}::interval)`;
	});
}

export const senderPreferencesGone = inbox.trait("inbox", "the sender preferences table is unavailable", () =>
	SqlClient.SqlClient.use((sql) => sql`drop table webhook_senders`),
);

export const mappingWaitsForResource = inbox.trait("inbox", "the mapping must wait for a resource", (state) => {
	state.resources.blocked = true;
});

export const resourceReleaseWaits = inbox.trait("inbox", "the acquired resource waits for permission to finish releasing", (state) =>
	Effect.gen(function* () {
		state.resources.releaseBlocked = true;
		yield* Effect.addFinalizer(() => Deferred.succeed(state.resources.releasePermit, undefined));
	}),
);

export const mappingRefusesDelivery = inbox.trait("inbox", "the mapping refuses the delivery after acquiring a resource", (state) => {
	state.resources.refused = true;
});

export function receiptsInSchema(schema: string) {
	return inbox.trait("host", `receipts belong to schema ${schema}`, (state) => {
		state.receiptsSchema = schema;
	});
}
