import { Context, Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { storeState } from "#test/storeState.ts";

const seeding = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const host = resolveHost("/synthetic", { database: { url: Redacted.value(database.url) }, namespace: STORAGE_NAMESPACE, provider: "local" });
		const sql = Context.get(yield* Layer.build(hostDatabase(host, "work-fleet-fixture", 1)), SqlClient.SqlClient);
		yield* sql`create table seed_writers (pid integer not null)`;
		yield* sql`create function track_seed_writer() returns trigger language plpgsql as $$
			begin insert into seed_writers values (pg_backend_pid()); return new; end;
		$$`;
		yield* sql`create trigger seed_writer after insert or update on ${sql(`${host.namespace}_records`)} for each row execute function track_seed_writer()`;
		return { host, sql };
	},
	layer: postgresLayer,
	name: "host record seeding",
	runIf: postgresEnabled,
	stages: ["database"],
	verbs: ({ host, sql }, story) => ({
		connection: () =>
			Effect.gen(function* () {
				const [row] = yield* sql<{ readonly pid: number }>`select pg_backend_pid() as pid`;
				if (row === undefined) {
					return yield* Effect.die(new Error("PostgreSQL did not report the seed connection PID"));
				}
				return row.pid;
			}),
		seed: (workId: string, stage: string) => {
			story.tell(`seed ${workId} as ${stage}`);
			return storeState(host, workId, { stage }).pipe(Effect.provideService(SqlClient.SqlClient, sql));
		},
		writers: () => sql<{ readonly pid: number; readonly writes: number }>`select pid, count(*)::integer as writes from seed_writers group by pid`,
	}),
});

seeding.it("100 inserts and an overwrite share the caller's single PostgreSQL connection", [], function* ({ seed, writers, connection }) {
	const caller = yield* connection();
	for (let index = 0; index < 100; index += 1) {
		yield* seed(`item-${index}`, "executing");
	}
	yield* seed("item-0", "completed");
	expect(yield* writers()).toEqual([{ pid: caller, writes: 101 }]);
});
