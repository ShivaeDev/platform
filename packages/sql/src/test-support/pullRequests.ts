import { DateTime, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class PullRequest extends Model.Class<PullRequest>("PullRequest")({
	id: Schema.Int,
	title: Schema.String,
	"updated_at": Schema.DateTimeUtcFromDate,
}) {}
export function pull(hour: number, id = 1) {
	return {
		id,
		title: `Revision ${hour}`,
		"updated_at": DateTime.makeUnsafe(`2026-10-25T${String(hour).padStart(2, "0")}:00:00Z`),
	};
}
export const syncOptions = {
	updateColumns: ["title", "updated_at"],
	updateWhere: { "updated_at": { lt: { excluded: "updated_at" } } },
} as const;
export const pullRequests = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_pulls_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer primary key check (id > 0), title text not null, updated_at timestamptz not null)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const rows = yield* makeRepository(PullRequest, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "PullRequest", tableName });
	return { rows, tableName };
});
