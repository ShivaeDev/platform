import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default (schema?: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const table = sql(schema === undefined ? "webhook_receipts" : `${schema}.webhook_receipts`);
		yield* sql`alter table ${table} add column job_ids_text text[]`;
		yield* sql`update ${table} set job_ids_text = array(select jsonb_array_elements_text(job_ids))`;
		yield* sql`alter table ${table} alter column job_ids_text set not null`;
		yield* sql`alter table ${table} drop column job_ids`;
		yield* sql`alter table ${table} rename column job_ids_text to job_ids`;
	});
