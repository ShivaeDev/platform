import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { auditQueue } from "#test/fixture.ts";
import { type HandledJob, type InboxState, inboxState, startHost } from "#test/host.ts";
import { postgresLayer } from "#test/postgresLayer.ts";
import { raceVerbs } from "#test/raceVerbs.ts";
import { type Delivery, deliver } from "#test/requests.ts";
import { requestOutcomes, secretsSeenIn, spanNames } from "#test/telemetry.ts";

interface ReceiptRow {
	readonly "delivery_id": string;
	readonly event: string;
	readonly "job_ids": readonly string[];
	readonly outcome: string;
	readonly source: string;
}

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
	clock: "live",
	create: () => inboxState(undefined),
	inspect: ({ answers, handled }) => ({ answers, handled }),
	layer: postgresLayer,
	name: "webhook inbox",
	stages: ["host", "inbox"],
	verbs: (state, story) => ({
		...raceVerbs(state, story.tell),
		answer: () => Effect.sync(() => state.answers.at(-1) ?? "no answer yet"),
		answers: () => Effect.sync(() => state.answers.toSorted()),
		deliver: (delivery: Delivery) => {
			story.tell(`github sends ${delivery}`);
			return deliver(state, delivery);
		},
		errorLogs: () => Effect.sync(() => state.logs.filter(({ level }) => level === "Error")),
		handledJobs: () => Effect.map(workersIdle(state), () => state.handled.map(jobName).toSorted()),
		requestOutcomes: () => Effect.sync(() => requestOutcomes(state)),
		secretsSeenIn: () => Effect.sync(() => secretsSeenIn(state)),
		spanNames: () => Effect.sync(() => spanNames(state)),
		storedReceipts: () =>
			Effect.gen(function* () {
				yield* workersIdle(state);
				const rows = yield* SqlClient.SqlClient.use(
					(sql) => sql<ReceiptRow>`select * from webhook_receipts order by source, delivery_id`.withoutTransform,
				);
				return rows.map((row) => ({
					delivery: row.delivery_id,
					event: row.event,
					jobs: row.job_ids.map((id) => receiptJobName(state, id)).toSorted(),
					outcome: row.outcome,
					source: row.source,
				}));
			}),
	}),
});

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
