import type { Job, PgBoss } from "pg-boss";
import { quotedSchema } from "#internal/storedRows.ts";

export async function expireAttempt(client: PgBoss, schema: string, job: Job<unknown>, cause: "expiry" | "heartbeat" = "expiry"): Promise<void> {
	if ((await client.schemaVersion()) !== 45) {
		throw new Error("Testing expiry requires pg-boss schema version 45");
	}
	const quoted = quotedSchema(schema);
	const timestamp = cause === "expiry" ? "started_on" : "heartbeat_on";
	const seconds = cause === "expiry" ? "expire_seconds" : "heartbeat_seconds";
	await client.getDb().executeSql(
		`UPDATE ${quoted}.job SET ${timestamp} = ${quoted}.job_now() - (${seconds} + 1) * interval '1 second'
		WHERE name = $1 AND id = $2 AND retry_count = $3 AND state = 'active'`,
		[job.name, job.id, job.retryCount],
	);
	// Supervision owns expiry and dead lettering; make its claim due with the job's deadline.
	await client
		.getDb()
		.executeSql(`UPDATE ${quoted}.queue SET monitor_claim_on = ${quoted}.job_now() - interval '1 week' WHERE name = $1`, [job.name]);
	await client.supervise(job.name);
}
