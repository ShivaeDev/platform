import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table webhook_receipts add column job_ids_text text[]`;
	yield* sql`update webhook_receipts set job_ids_text = array(select jsonb_array_elements_text(job_ids))`;
	yield* sql`alter table webhook_receipts alter column job_ids_text set not null`;
	yield* sql`alter table webhook_receipts drop column job_ids`;
	yield* sql`alter table webhook_receipts rename column job_ids_text to job_ids`;
});
