import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { addShapeColumns } from "#storage/addShapeColumns.ts";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { modelTables } from "#storage/modelTables.ts";
import { pruneEmptyCycles } from "#storage/pruneEmptyCycles.ts";
import { recordTimeColumns } from "#storage/recordTimes.ts";
import { shapeV12 } from "#storage/shapeV12.ts";
import { shapeV14 } from "#storage/shapeV14.ts";
import { typedTables } from "#storage/typedTables.ts";

const releaseReasonColumn = { kind: "string", name: "releaseReason" } as const;

export const fleetMigrations = Effect.fn("FleetStore.fleetMigrations")(function* (namespace: string) {
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
		"5_model_tables": modelTables(namespace),
		"6_decision_codes": backfillDecisionCodes(namespace),
		"7_release_reason": sql`alter table ${sql(`${namespace}_records`)} add column if not exists ${sql(releaseReasonColumn.name)} text`,
		"8_record_times": Effect.gen(function* () {
			for (const name of Object.keys(recordTimeColumns)) {
				yield* sql`alter table ${sql(`${namespace}_records`)} add column ${sql(name)} double precision`;
			}
		}),
		"9_integration_retry": sql`alter table ${sql(`${namespace}_records`)} add column ${sql("integrationRetry")} text`,
		"10_prune_empty_cycles": pruneEmptyCycles(namespace),
		"11_pending_answers": sql`alter table ${sql(`${namespace}_records`)} add column ${sql("pendingAnswers")} text`,
		"12_typed_tables": typedTables(namespace),
		"13_dispatch_requests": sql`create table ${sql(`${namespace}_dispatches`)} (
			work_id text primary key, request_id text not null, accepted_at double precision not null,
			completed_at double precision, status text not null, error text
		)`,
		"14_dispatch_now": Effect.gen(function* () {
			yield* addShapeColumns(namespace, shapeV12, shapeV14);
			yield* sql`alter table ${sql(`${namespace}_dispatches`)} add column now boolean, add column ignore_areas boolean`;
		}),
		"15_answer_requests": sql`create table ${sql(`${namespace}_answers`)} (
			request_id text primary key, work_id text not null, decision_id text, accepted_at double precision not null,
			position integer generated always as identity, decision_code text, decision_reason text not null,
			text text not null, release boolean not null, error text, response_decision_id text, response_id text
		)`,
	});
});
