import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "#postgres.ts";
import { adminUrl } from "./postgres.ts";

export type InitializerSource = "the template URL" | "the supplied client";

export function initializerLayer(source: InitializerSource) {
	const preparation = { fixtures: 0, initializer: 0, released: 0 };
	const initialize = Effect.gen(function* () {
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				preparation.released += 1;
			}),
		);
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table app_state (value text not null)`;
		yield* sql`insert into app_state values ('initialized')`;
		preparation.initializer += 1;
	});
	const layer = makePostgresTestLayer({
		fixtures: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update app_state set value = 'ready'`;
			preparation.fixtures += 1;
		}),
		initialize:
			source === "the supplied client"
				? initialize
				: (url) => Effect.flatMap(PgClient.makeClient({ url }), (client) => initialize.pipe(Effect.provideService(SqlClient.SqlClient, client))),
		url: adminUrl,
	});
	return { layer, preparation };
}
