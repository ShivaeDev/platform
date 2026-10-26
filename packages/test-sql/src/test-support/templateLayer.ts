import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { makePostgresTestLayer } from "#postgres.ts";
import { setup } from "./postgres.ts";

const fixture = setup();
export const preparation = Object.assign(fixture.counts, { loaders: 0, released: 0, url: "" });

export const templateLayer = makePostgresTestLayer({
	...fixture.options,
	fixtures: (url) =>
		Effect.gen(function* () {
			preparation.loaders += 1;
			yield* fixture.options.fixtures;
			const client = yield* PgClient.makeClient({ url });
			const [row] = yield* client<{ name: string }>`select current_database() as name`;
			preparation.url = row?.name ?? "";
			yield* client`create table app_options_fixture (template text not null)`;
			yield* client`insert into app_options_fixture values (current_database())`;
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					preparation.released += 1;
				}),
			);
		}),
});
