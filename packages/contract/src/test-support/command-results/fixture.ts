import { Effect, Option, Redacted, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { commandResult } from "#commandResult.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer, signedIn } from "#readPolicy.ts";

export const pots = collection("shared_pots", Schema.Number, { viewerId: Schema.String });
export class Viewer extends RpcMiddleware.Service<Viewer>()("@shivaedev/contract/test/PotViewer") {}
export const Pot = Schema.Struct({ household: Schema.String, id: Schema.Number, title: Schema.String });
export const Pots = contract("pots", {
	commands: [
		command("move", {
			invalidates: ({ id }) => [pots.item(id)],
			payload: { household: Schema.String, id: Schema.Number, reject: Schema.Boolean },
			rejections: { Conflict },
			success: Pot,
		}),
	],
	queries: [
		query("list", {
			readPolicy: signedIn,
			reads: (_payload, viewer) => (Option.isSome(viewer) ? [pots.bucket.viewerId(viewer.value.id)] : []),
			success: Schema.Array(Pot),
		}),
	],
}).middleware(Viewer);

export const migrations = {
	loader: Migrator.fromRecord({
		"1_shared_pots": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table shared_pots (id integer primary key, household text not null, title text not null)`;
			yield* sql`create table household_members (household text not null, viewer_id text not null)`;
			yield* sql`create table pot_eaters (pot_id integer not null, viewer_id text not null)`;
			yield* sql`insert into shared_pots values (1, 'old', 'Soup'), (2, 'other', 'Stew')`;
			yield* sql`insert into household_members values ('old', 'alice'), ('new', 'carol'), ('other', 'dana')`;
			yield* sql`insert into pot_eaters values (1, 'bob'), (1, 'alice')`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });

export const handlers = Pots.application.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		function audience(id: number) {
			return sql<{ "viewer_id": string }>`
		select m.viewer_id from household_members m join shared_pots p on p.household = m.household where p.id = ${id}
		union select viewer_id from pot_eaters where pot_id = ${id} order by viewer_id`;
		}
		return {
			"pots.list": () =>
				Effect.gen(function* () {
					const viewer = yield* CurrentViewer;
					if (Option.isNone(viewer)) {
						return [];
					}
					return yield* sql<typeof Pot.Type>`select p.* from shared_pots p where
				exists (select 1 from household_members m where m.household = p.household and m.viewer_id = ${viewer.value.id})
				or exists (select 1 from pot_eaters e where e.pot_id = p.id and e.viewer_id = ${viewer.value.id}) order by p.id`;
				}).pipe(Effect.orDie),
			"pots.move": ({ id, household, reject }) =>
				Effect.gen(function* () {
					const before = yield* audience(id);
					const rows = yield* sql<typeof Pot.Type>`update shared_pots set household = ${household} where id = ${id} returning *`;
					yield* sql`delete from pot_eaters where pot_id = ${id} and viewer_id = 'alice'`;
					const after = yield* audience(id);
					const result = yield* commandResult({
						invalidates: [...before, ...after].map(({ viewer_id }) => pots.bucket.viewerId(viewer_id)),
						result: rows[0],
					});
					if (reject) {
						return yield* new Conflict({ message: "Move rejected" });
					}
					if (result === undefined) {
						return yield* Effect.die("Missing pot");
					}
					return result;
				}).pipe(transact({ onSqlError: (error) => error }), Effect.catchTag("SqlError", Effect.die)),
		};
	}),
);
