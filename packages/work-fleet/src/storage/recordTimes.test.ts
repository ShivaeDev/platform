import { expect } from "vitest";
import { itemRecord } from "#test/fleetItemStore.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { timedStorage } from "#test/storageStory.ts";

timedStorage.it("an edit keeps the step entry time and moves the update time", [], function* ({ now, openFleetStore, secondPasses }) {
	const store = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
	const start = yield* now();
	const queued = yield* store.insert(itemRecord("queued"));
	yield* secondPasses();

	const edited = yield* store.compareAndSet(queued.value.workId, queued.version, { ...queued.value, prompt: "Edited" });

	expect(edited.value).toMatchObject({ stageEnteredAt: start, updatedAt: start + 1000 });
});

timedStorage.it("finishing work sets its step entry, completion and update times to now", [], function* ({ now, openFleetStore, secondPasses }) {
	const store = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
	const start = yield* now();
	const queued = yield* store.insert(itemRecord("queued"));
	yield* secondPasses();

	const done = yield* store.compareAndSet(queued.value.workId, queued.version, { ...queued.value, step: "done" });

	expect(done.value).toMatchObject({ completedAt: start + 1000, stageEnteredAt: start + 1000, updatedAt: start + 1000 });
});

timedStorage.it("an edit of finished work keeps its completion and step entry times", [], function* ({ now, openFleetStore, secondPasses }) {
	const store = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
	const start = yield* now();
	const queued = yield* store.insert(itemRecord("queued"));
	const done = yield* store.compareAndSet(queued.value.workId, queued.version, { ...queued.value, step: "done" });
	yield* secondPasses();

	const recorded = yield* store.compareAndSet(done.value.workId, done.version, { ...done.value, prompt: "Recorded" });

	expect(recorded.value).toMatchObject({ completedAt: start, stageEnteredAt: start, updatedAt: start + 1000 });
	expect(yield* store.load(recorded.value.workId)).toEqual(recorded);
});

timedStorage.it(
	"requeueing finished work after a restart enters the queue now and clears its completion time",
	[],
	function* ({ now, openFleetStore, secondPasses }) {
		const store = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
		const start = yield* now();
		const queued = yield* store.insert(itemRecord("queued"));
		const done = yield* store.compareAndSet(queued.value.workId, queued.version, { ...queued.value, step: "done" });
		const restarted = yield* openFleetStore({ namespace: STORAGE_NAMESPACE });
		yield* secondPasses();

		const requeued = yield* restarted.compareAndSet(done.value.workId, done.version, { ...done.value, step: "queued" });

		expect(requeued.value).toMatchObject({ stageEnteredAt: start + 1000, updatedAt: start + 1000 });
		expect(requeued.value.completedAt).toBeUndefined();
	},
);
