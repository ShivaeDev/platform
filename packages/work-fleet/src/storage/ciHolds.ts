import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable } from "#storage/recordChildren.ts";

export const ciHolds = Effect.fn("FleetStore.ciHolds")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	for (const table of [`${namespace}_records`, childTable(namespace, ["history"])]) {
		yield* sql`alter table ${sql(table)} add column "ciApprovedHead" text, add column "ciHold" boolean,
			add column "ciHold__head" text, add column "ciHold__paths" text[]`;
	}
});
