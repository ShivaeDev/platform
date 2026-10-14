import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { modelTableColumns, modelTables } from "#storage/modelTables.ts";
import { recordTimeColumns } from "#storage/recordTimes.ts";

const releaseReasonColumn = { kind: "string", name: "releaseReason" } as const;

// PostgreSQL text cannot distinguish scalar strings from serialized JSON.
export const fleetMigrationColumns = { ...modelTableColumns, [releaseReasonColumn.name]: releaseReasonColumn.kind, ...recordTimeColumns } as const;

export const fleetMigrations = Effect.fn("FleetStore.fleetMigrations")(function* (namespace: string, legacyOnly = false) {
	const sql = yield* SqlClient.SqlClient;
	return yield* Migrator.fromRecord({
		"1_fleet_records": Effect.gen(function* () {
			yield* sql`create table ${sql(`${namespace}_records`)} (work_id text primary key, version integer not null check (version > 0), payload jsonb not null)`;
			yield* sql`create table ${sql(`${namespace}_foreign_reservations`)} (owner text primary key, paths jsonb not null, executing boolean not null, backlog boolean not null)`;
		}),
		"2_occupancy_only_foreign_reservations": sql`alter table ${sql(`${namespace}_foreign_reservations`)} drop column paths`,
		"3_admission_order": sql`alter table ${sql(`${namespace}_records`)} add column admission_order bigint generated always as identity`,
		"4_attention_owner": sql`update ${sql(`${namespace}_records`)} set version = version + 1,
				payload = case
					when payload->>'stage' = 'needs-human' and payload->'decision' is not null
						and (payload->'decision'->>'attentionOwner' is null or payload->'decision'->'published' is not null or payload->'decision'->>'reason' = 'Reviewed PR is ready to merge')
					then jsonb_set(jsonb_set(payload, '{attentionOwner}', '"maintainer"'::jsonb), '{decision,attentionOwner}', '"maintainer"'::jsonb)
					else jsonb_set(payload, '{attentionOwner}',
						case when (payload->>'stage' = 'validating' and payload->'checks'->>'pending' = 'true')
							or payload->'launchRetry' is not null
							or payload->>'blocker' = 'Fresh available provider quota is required'
							or payload->>'blocker' ~ '^(execution|backlog) capacity is occupied'
							or payload->>'blocker' like 'waiting for area %'
						then '"automation"'::jsonb else '"orchestrator"'::jsonb end)
					end
				where payload->>'attentionOwner' is null and
					(payload->>'stage' = 'needs-human' or payload->>'blocker' is not null or payload->'launchRetry' is not null or
					(payload->>'stage' = 'validating' and payload->'checks'->>'pending' = 'true'))`,
		...(legacyOnly
			? {}
			: {
					"5_model_tables": modelTables(namespace),
					"6_decision_codes": backfillDecisionCodes(namespace),
					"7_release_reason": sql`alter table ${sql(`${namespace}_records`)} add column if not exists ${sql(releaseReasonColumn.name)} text`,
					"8_record_times": Effect.gen(function* () {
						for (const name of Object.keys(recordTimeColumns)) {
							yield* sql`alter table ${sql(`${namespace}_records`)} add column ${sql(name)} double precision`;
						}
					}),
				}),
	});
});
