import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { FleetRepository, fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { childTable } from "#storage/recordChildren.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
export const sessionInput = { cwd: "/workspace/synthetic", operationId: "synthetic-operation", prompt: "Synthetic work" };
export const openSessionJournal = Effect.gen(function* () {
	const repository = yield* Layer.build(postgresFleetRepository(STORAGE_NAMESPACE));
	const store = Context.get(repository, FleetRepository);
	const journal = yield* Layer.build(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(store))));
	return { journal, store };
});

export const sessionPersistence = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const { journal, store } = yield* openSessionJournal;
	yield* store.insert(
		namedRecord(
			"synthetic-work",
			[
				{ ...namedAttempt("worker"), operationId: sessionInput.operationId },
				{ ...namedAttempt("reviewer"), operationId: "review" },
			],
			"# Synthetic work",
		),
	);
	const read = Effect.scoped(
		openSessionJournal.pipe(
			Effect.flatMap(({ store: reopened }) => reopened.load("synthetic-work")),
			Effect.map((record) => record?.value.attempts),
		),
	).pipe(Effect.provide(hostDatabase(database.url, "session-journal-reader", 1)));
	const reserveContinuation = Effect.gen(function* () {
		const record = yield* store.load("synthetic-work");
		if (record === undefined) {
			return yield* Effect.die("The submission intent is missing");
		}
		yield* store.compareAndSet("synthetic-work", record.version, {
			...record.value,
			attempts: [...record.value.attempts, { ...namedAttempt("worker"), operationId: "repair" }],
		});
	});
	return { journal, read, reserveContinuation };
});

export function refuseAcknowledgement(field: "sessionId" | "receipt__turnId") {
	return SqlClient.SqlClient.pipe(
		Effect.flatMap((sql) => sql`alter table ${sql(childTable(STORAGE_NAMESPACE, ["attempts"]))} add check (${sql(field)} is null)`),
	);
}
