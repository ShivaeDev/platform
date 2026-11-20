import { Deferred, Effect, Queue, Redacted, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

export const entries = collection("reflected_entries", Schema.Number);

export const Entries = contract("entries", {
	commands: [
		command("add", {
			invalidates: () => [entries.list],
			payload: { reject: Schema.Boolean, titles: Schema.Array(Schema.String) },
			rejections: { Conflict },
			success: Schema.Void,
		}),
		command("stamp", { invalidates: () => [entries.list], payload: { title: Schema.String }, success: Schema.Void }),
		command("touch", { invalidates: () => [], success: Schema.Void }),
	],
	queries: [query("list", { readPolicy: () => Effect.succeed(true), reads: () => [entries.list], success: Schema.Array(Schema.String) })],
});

export const migrations = {
	loader: Migrator.fromRecord({
		"1_reflected_entries": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table reflected_entries (id serial primary key, title text not null)`;
			yield* sql`insert into reflected_entries (title) values ('First')`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });

export interface ReadGate {
	held: Deferred.Deferred<void> | undefined;
	readonly reached: Queue.Queue<void>;
}

export function handlers(reads: ReadGate) {
	return Entries.application.toLayer(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			function insert(title: string) {
				return Effect.asVoid(sql`insert into reflected_entries (title) values (${title})`);
			}
			// Every title commits in a transaction of its own, which announces the list at its commit.
			function add(title: string, reject: boolean) {
				return Effect.gen(function* () {
					yield* insert(title);
					yield* invalidateOnCommit(invalidationKeys([entries.list]));
					if (reject) {
						return yield* new Conflict({ message: `${title} is refused` });
					}
				}).pipe(transact(), Effect.catchTag("SqlError", Effect.die));
			}
			return {
				"entries.add": ({ reject, titles }) => Effect.forEach(titles, (title) => add(title, reject), { discard: true }),
				"entries.list": () =>
					Effect.gen(function* () {
						yield* Queue.offer(reads.reached, undefined);
						if (reads.held !== undefined) {
							yield* Deferred.await(reads.held);
						}
						const rows = yield* sql<{ title: string }>`select title from reflected_entries order by id`;
						return rows.map(({ title }) => title);
					}).pipe(Effect.orDie),
				// The write announces nothing itself, so only the command's declared keys tell the list.
				"entries.stamp": ({ title }) => Effect.orDie(insert(title)),
				"entries.touch": () => Effect.void,
			};
		}),
	);
}
