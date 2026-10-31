import { expect } from "vitest";
import { competingStorage } from "#test/competingStorage.ts";
import { refusal } from "#test/refusal.ts";
import { record } from "#test/storage.ts";
import { isolatedStorage, storage } from "#test/storageStory.ts";

storage.it("a submitting record and its operation survive a restart unchanged", [], function* ({ restart, store }) {
	const prepared = yield* store.insert(record("board-a"));
	const submitting = yield* store.compareAndSet("board-a", prepared.version, { ...prepared.value, operationId: "operation-a", step: "submitting" });

	const restarted = yield* restart();

	expect(yield* restarted.load("board-a")).toEqual(submitting);
});

storage.it("after a restart the accepted receipt is saved on the version written before it", [], function* ({ restart, store }) {
	const prepared = yield* store.insert(record("board-a"));
	const submitting = yield* store.compareAndSet("board-a", prepared.version, { ...prepared.value, operationId: "operation-a", step: "submitting" });
	const restarted = yield* restart();

	yield* restarted.compareAndSet(
		"board-a",
		submitting.version,
		{ ...submitting.value, sessionId: "session-a", step: "running", turnId: "turn-a" },
		{ maxExecuting: 1 },
	);

	expect((yield* store.load("board-a"))?.value).toEqual({
		operationId: "operation-a",
		sessionId: "session-a",
		step: "running",
		turnId: "turn-a",
		workId: "board-a",
	});
});

isolatedStorage.it(
	"of two racing writes on one version the stale one is refused and the winner is kept",
	[],
	function* ({ advance, concurrently, stepOf, store }) {
		const prepared = yield* store.insert(record("board-a"));
		const steps = ["terminal", "completed"] as const;

		const writes = yield* concurrently(...steps.map((step) => advance(prepared, { step })));

		expect(writes.toSorted((left, right) => left.localeCompare(right))).toEqual(["accepted", "storage conflict on board-a: expected 1, found 2"]);
		expect(yield* stepOf("board-a")).toBe(steps[writes.indexOf("accepted")]);
	},
);

storage.it("each foreign PR holds its own backlog slot until it is released", [], function* ({ admission, store }) {
	yield* store.reserveForeign("pr-one", { backlog: true, executing: false });
	yield* store.reserveForeign("pr-two", { backlog: true, executing: false });
	expect(yield* admission({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 })).toBe("backlog capacity of 2 is full");

	yield* store.releaseForeign("pr-one");

	expect(yield* admission({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 })).toBe("accepted");
});

isolatedStorage.it(
	"a writer racing after Fleet's version check makes Fleet's write a conflict and keeps the racing write",
	[],
	function* ({ namespace }) {
		const store = yield* competingStorage(namespace);
		const original = yield* store.insert(record("board-a"));

		const write = yield* refusal(store.compareAndSet("board-a", original.version, { ...original.value, step: "completed" }));

		expect(write).toBe("storage conflict on board-a: expected 1, found 2");
		expect(yield* store.load("board-a")).toEqual({ value: { ...original.value, step: "running" }, version: 2 });
	},
);
