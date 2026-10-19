import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable } from "#storage/recordChildren.ts";

export const predictedConflicts = Effect.fn("FleetStore.predictedConflicts")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	for (const archived of [false, true]) {
		const table = archived ? childTable(namespace, ["history"]) : `${namespace}_records`;
		yield* sql`alter table ${sql(table)}
			add column "mergePrediction" boolean, add column "mergePrediction__head" text,
			add column "mergePrediction__mainRevision" text, add column "mergePrediction__observedAt" text,
			add column "mergePrediction__mergedPrs" text[], add column "mergePrediction__conflicts" boolean,
			add column "predictedConflictHold" boolean, add column "predictedConflictHold__head" text,
			add column "predictedConflictHold__prs" text[]`;
		const path = [...(archived ? ["history"] : []), "mergePrediction", "conflicts"];
		const positions = archived ? ["position0", "position1"] : ["position0"];
		yield* sql`create table ${sql(childTable(namespace, path))} (
			work_id text not null references ${sql(`${namespace}_records`)} (work_id) on delete cascade,
			${sql.csv(positions.map((name) => sql`${sql(name)} integer not null check (${sql(name)} >= 0)`))},
			files text[], head text, "observedAt" text, "otherHead" text, "otherPr" text, wait boolean,
			primary key (work_id, ${sql.csv(positions.map((name) => sql`${sql(name)}`))})
		)`;
	}
});
