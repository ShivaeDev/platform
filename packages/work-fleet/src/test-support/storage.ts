import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Option, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { AdmissionLimits, Versioned } from "#storage/model.ts";

export const storageDatabaseUrl = Option.getOrUndefined(Effect.runSync(Config.option(Config.string("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"))));

export const StorageRecord = Schema.Struct({
	operationId: Schema.optional(Schema.String),
	paths: Schema.Array(Schema.String),
	sessionId: Schema.optional(Schema.String),
	stage: Schema.Literals(["prepared", "submitting", "running", "terminal", "completed"]),
	submittedAt: Schema.optional(Schema.Number),
	turnId: Schema.optional(Schema.String),
	workId: Schema.String,
});

export function record(workId: string, path: string): typeof StorageRecord.Type {
	return { paths: [path], stage: "prepared", workId };
}

export function storageOptions(namespace: string) {
	return {
		backlog: (value: typeof StorageRecord.Type) => value.stage === "terminal",
		executing: (value: typeof StorageRecord.Type) => value.stage === "submitting" || value.stage === "running",
		namespace,
		owns: (value: typeof StorageRecord.Type) => value.stage !== "completed",
		reservations: (value: typeof StorageRecord.Type) => value.paths,
		submissions: (value: typeof StorageRecord.Type, since: number) => (value.submittedAt !== undefined && value.submittedAt >= since ? 1 : 0),
	};
}

export function withStorage<A, E>(
	use: (store: Effect.Success<ReturnType<typeof makeTestStore>>, namespace: string) => Effect.Effect<A, E, SqlClient.SqlClient>,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const namespace = `fleet_test_${crypto.randomUUID().replaceAll("-", "")}`;
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					for (const suffix of ["records", "foreign_reservations", "migrations"]) {
						yield* sql`drop table if exists ${sql(`${namespace}_${suffix}`)}`;
					}
				}).pipe(Effect.orDie),
			);
			const store = yield* makeTestStore(namespace);
			yield* store.initialize();
			return yield* use(store, namespace);
		}),
	).pipe(
		Effect.provide(
			PgClient.layer({
				maxConnections: 4,
				url: Redacted.make(storageDatabaseUrl ?? "postgresql://integration-tests-disabled"),
			}),
		),
	);
}

export function makeTestStore(namespace: string) {
	return makePostgresFleetStore(StorageRecord, storageOptions(namespace));
}

export function submitAgainstQuota(
	store: Effect.Success<ReturnType<typeof makeTestStore>>,
	entry: Versioned<typeof StorageRecord.Type>,
	limits: AdmissionLimits,
) {
	return store.compareAndSet(
		entry.value.workId,
		entry.version,
		{
			...entry.value,
			operationId: `operation-${entry.value.workId}`,
			stage: "submitting",
			submittedAt: 101,
		},
		limits,
	);
}
