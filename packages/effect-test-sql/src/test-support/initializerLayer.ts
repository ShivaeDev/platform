import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "#postgres.ts";
import { adminUrl } from "./postgres.ts";

export function initializerLayer(source: "url" | "client") {
	const preparation = { completed: 0, fixtures: 0, released: 0, started: 0 };
	const initialize = Effect.gen(function* () {
		preparation.started += 1;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				preparation.released += 1;
			}),
		);
		yield* Effect.yieldNow;
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table app_state (value text not null, initialized_in text not null)`;
		yield* sql`insert into app_state values ('initialized', current_database())`;
		preparation.completed += 1;
	});
	const layer = makePostgresTestLayer({
		fixtures: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update app_state set value = 'ready'`;
			preparation.fixtures += 1;
		}),
		initialize:
			source === "client"
				? initialize
				: (url) => Effect.flatMap(PgClient.makeClient({ url }), (client) => initialize.pipe(Effect.provideService(SqlClient.SqlClient, client))),
		url: adminUrl,
	});
	return { layer, preparation };
}
