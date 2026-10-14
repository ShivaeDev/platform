import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { FleetRecord } from "#model.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { itemRecord } from "#test/fleetItemStore.ts";
import { postgresTests } from "#test/postgres.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

const test = postgresTests("test");

test("PostgreSQL writes retain stage entry time, update write time and reset completion time on requeue", function* () {
	const store = yield* makePostgresFleetStore(FleetRecord, { namespace: STORAGE_NAMESPACE });
	const now = yield* Clock.currentTimeMillis;
	let entry = yield* store.insert(itemRecord("prepared"));
	expect(entry.value).toMatchObject({ stageEnteredAt: now, updatedAt: now });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, prompt: "Edited" });
	expect(entry.value).toMatchObject({ stageEnteredAt: now, updatedAt: now + 1000 });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, stage: "completed" });
	expect(entry.value).toMatchObject({ completedAt: now + 2000, stageEnteredAt: now + 2000, updatedAt: now + 2000 });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, prompt: "Recorded" });
	expect(entry.value).toMatchObject({ completedAt: now + 2000, stageEnteredAt: now + 2000, updatedAt: now + 3000 });
	expect(yield* store.load(entry.value.workId)).toEqual(entry);
	const restarted = yield* makePostgresFleetStore(FleetRecord, { namespace: STORAGE_NAMESPACE });
	yield* TestClock.adjust("1 second");
	entry = yield* restarted.compareAndSet(entry.value.workId, entry.version, { ...entry.value, stage: "prepared" });
	expect(entry.value).toMatchObject({ stageEnteredAt: now + 4000, updatedAt: now + 4000 });
	expect(entry.value.completedAt).toBeUndefined();
	const conflict = yield* restarted.compareAndSet(entry.value.workId, entry.version - 1, { ...entry.value, stage: "completed" }).pipe(Effect.exit);
	expect(conflict._tag).toBe("Failure");
	expect(yield* restarted.load(entry.value.workId)).toEqual(entry);
});
