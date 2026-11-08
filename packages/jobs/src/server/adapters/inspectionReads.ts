import { Schema } from "effect";
import type { PgBossClient } from "#server/adapters/client.ts";
import { inspectionDeferrals } from "#server/adapters/inspectionDeferrals.ts";
import { inspectionJobs } from "#server/adapters/inspectionJobs.ts";
import { inspectionOperation } from "#server/adapters/inspectionOperation.ts";
import { inspectionSnapshot } from "#server/adapters/inspectionSnapshot.ts";
import type { QueueDefinition } from "#server/definition.ts";
import { quotedSchema } from "#server/storedRows.ts";

const Busy = Schema.Struct({ busy: Schema.Boolean });
export function inspectionReads(client: PgBossClient, schema: string) {
	const quoted = quotedSchema(schema);
	function query(text: string, values?: unknown[]) {
		const db = client.getDb?.();
		if (db === undefined) {
			throw new TypeError("This pg-boss client does not support getDb");
		}
		return db.executeSql(text, values);
	}
	return {
		...inspectionDeferrals(client),
		busy: (queues: readonly Pick<QueueDefinition, "name">[]) =>
			inspectionOperation(async () => {
				const { rows } = await query(
					`/* jobs inspection busy */ SELECT EXISTS (
				SELECT 1 FROM ${quoted}.job WHERE name = ANY($1::text[]) AND (
					(state < 'active' AND NOT blocked AND start_after <= ${quoted}.job_now()) OR state = 'active'
				)
			) AS busy`,
					[queues.map(({ name }) => name)],
				);
				return Schema.decodeUnknownSync(Busy)(rows[0]).busy;
			}),
		queue: (queue: Pick<QueueDefinition, "name">) => inspectionOperation(() => client.getQueue(queue.name), queue.name),
		schedules: (name?: string, key?: string) =>
			inspectionOperation(() => {
				if (client.getSchedules === undefined) {
					throw new TypeError("This pg-boss client does not support getSchedules");
				}
				return client.getSchedules(name, key);
			}),
		schemaVersion: () =>
			inspectionOperation(() => {
				if (client.schemaVersion === undefined) {
					throw new TypeError("This pg-boss client does not support schemaVersion");
				}
				return client.schemaVersion();
			}),
		snapshot: inspectionSnapshot(client, schema),
		storedJobs: inspectionJobs(client).storedJobs,
	};
}
