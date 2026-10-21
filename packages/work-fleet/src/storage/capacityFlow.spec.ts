import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { record, submitAgainstQuota } from "#test/storage.ts";
import { isolatedStorage, storage } from "#test/storageStory.ts";

const integration = storage;
const isolated = isolatedStorage;

integration.it("releases execution capacity when execution turns terminal", [], function* ({ store }) {
	const first = yield* store.insert({ ...record("board-a"), step: "submitting" }, { maxExecuting: 1 });
	expect(Exit.isFailure(yield* store.insert({ ...record("board-b"), step: "submitting" }, { maxExecuting: 1 }).pipe(Effect.exit))).toBe(true);
	yield* store.compareAndSet("board-a", first.version, { ...first.value, step: "terminal" });
	yield* store.insert({ ...record("board-b"), step: "submitting" }, { maxExecuting: 1 });
});

isolated.it("atomically admits only one submission against a shared remaining quota observation", [], function* ({ store }) {
	const first = yield* store.insert(record("board-a"));
	const second = yield* store.insert(record("board-b"));
	const limits = { maxExecuting: 2, quota: { available: 1, observedAt: 100 } };
	const results = yield* Effect.all(
		[first, second].map((entry) => submitAgainstQuota(store, entry, limits).pipe(Effect.exit)),
		{ concurrency: 2 },
	);
	expect(results.filter(Exit.isSuccess)).toHaveLength(1);
	expect(results.filter(Exit.isFailure)).toHaveLength(1);
	expect((yield* store.list()).filter((entry) => entry.value.step === "submitting")).toHaveLength(1);
});

integration.it("rechecks current foreign backlog in the submission transaction", [], function* ({ store }) {
	yield* store.reserveForeign("pr-backlog", { backlog: true, executing: false });
	const prepared = yield* store.insert(record("board-a"));
	const fullBacklog = yield* store
		.compareAndSet("board-a", prepared.version, { ...prepared.value, step: "submitting" }, { maxBacklog: 1 })
		.pipe(Effect.exit);
	expect(Exit.isFailure(fullBacklog)).toBe(true);
	expect((yield* store.load("board-a"))?.value.step).toBe("queued");
});
