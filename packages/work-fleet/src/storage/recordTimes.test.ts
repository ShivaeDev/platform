import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { itemRecord } from "#test/fleetItemStore.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { timedStorage } from "#test/storageStory.ts";

const test = timedStorage;

test.it("PostgreSQL writes retain step entry time, update write time and reset completion time on requeue", [], function* ({ openFleetStore }) {
	const store = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
	const now = yield* Clock.currentTimeMillis;
	let entry = yield* store.insert(itemRecord("queued"));
	expect(entry.value).toMatchObject({ stageEnteredAt: now, updatedAt: now });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, prompt: "Edited" });
	expect(entry.value).toMatchObject({ stageEnteredAt: now, updatedAt: now + 1000 });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, step: "done" });
	expect(entry.value).toMatchObject({ completedAt: now + 2000, stageEnteredAt: now + 2000, updatedAt: now + 2000 });
	yield* TestClock.adjust("1 second");
	entry = yield* store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, prompt: "Recorded" });
	expect(entry.value).toMatchObject({ completedAt: now + 2000, stageEnteredAt: now + 2000, updatedAt: now + 3000 });
	expect(yield* store.load(entry.value.workId)).toEqual(entry);
	const restarted = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
	yield* TestClock.adjust("1 second");
	entry = yield* restarted.compareAndSet(entry.value.workId, entry.version, { ...entry.value, step: "queued" });
	expect(entry.value).toMatchObject({ stageEnteredAt: now + 4000, updatedAt: now + 4000 });
	expect(entry.value.completedAt).toBeUndefined();
	const conflict = yield* restarted.compareAndSet(entry.value.workId, entry.version - 1, { ...entry.value, step: "done" }).pipe(Effect.exit);
	expect(conflict._tag).toBe("Failure");
	expect(yield* restarted.load(entry.value.workId)).toEqual(entry);
});
