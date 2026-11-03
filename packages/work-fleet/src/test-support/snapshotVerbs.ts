import { Deferred, Effect, Fiber } from "effect";
import type { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { recordModel } from "#storage/model.ts";
import { readRecordSnapshot, readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValue } from "#storage/recordValue.ts";

export function snapshotVerbs(sql: SqlClient.SqlClient, tell: (line: string) => void) {
	return {
		heldSnapshotRead: Effect.fn("StorageStory.heldSnapshotRead")(function* (snapshotNamespace: string, workId: string, kind: "records" | "receipt") {
			tell(`a ${kind} snapshot read of ${workId} pauses after reading its root row`);
			const repository = yield* makeRepository(recordModel(), {
				idColumn: "work_id",
				spanPrefix: "Snapshot",
				tableName: `${snapshotNamespace}_records`,
			});
			const entered = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const read = Effect.gen(function* () {
				const row = yield* repository.findById(workId);
				yield* Deferred.succeed(entered, undefined);
				yield* Deferred.await(resume);
				return yield* recordValue(row, recordShape(), snapshotNamespace);
			});
			const reader = yield* (kind === "records" ? readRecords(snapshotNamespace, read) : readRecordSnapshot(read)).pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			return {
				result: () => Fiber.join(reader),
				resume: () => {
					tell("the paused snapshot read continues");
					return Deferred.succeed(resume, undefined);
				},
			};
		}),
		inBackground: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.forkChild(effect).pipe(Effect.map((fiber) => ({ result: () => Fiber.join(fiber) }))),
		writerWaitsForSnapshot: () => {
			tell("the writer waits for the snapshot's lock");
			return observeUntil(
				sql<{ readonly waiting: number }>`select count(*)::integer as waiting from pg_locks
				where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database())`,
				(rows) => rows[0]?.waiting === 1,
				"the writer waiting for the snapshot lock",
			).pipe(Effect.asVoid);
		},
	};
}
