import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { PgBoss } from "pg-boss";
import { transact } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { defineQueue } from "#definition.ts";
import { makePgBoss, pgBossLayer } from "#service.ts";
import { postgresLayer } from "#test/postgresLayer.ts";

const Jobs = makePgBoss("@test/TransactionalJobs");
const queue = defineQueue({ name: "transactional", schema: Schema.Struct({ id: Schema.Number }) });

export const transactionalJobs = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const { url } = yield* PostgresTestDatabase;
		const sql = yield* SqlClient.SqlClient;
		const client = new PgBoss({ connectionString: Redacted.value(url), schedule: false, supervise: false });
		const services = yield* Layer.build(
			Jobs.layer({ jobs: [queue] }).pipe(
				Layer.provide(pgBossLayer({ clientFactory: () => client, connectionString: url, schedule: false, supervise: false })),
			),
		);
		return { client, jobs: Context.get(services, Jobs), sql };
	},
	layer: postgresLayer,
	name: "transactional jobs",
	stages: [],
	verbs: ({ client, jobs, sql }, story) => ({
		enqueue: (id: number) => {
			story.tell(`enqueue ${id}`);
			return jobs.enqueue(queue, { id });
		},
		job: (id: string) => jobs.getJob(queue, id),
		storedJobs: () => Effect.tryPromise(() => client.findJobs(queue.name)),
		transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			transact(effect, { onSqlError: (error) => error }).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
	}),
});
