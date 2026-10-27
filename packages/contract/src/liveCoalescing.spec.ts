import { Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { postgresLive } from "#test/postgresLive.ts";

postgresLive.it("50 committed edits refetch the affected item and list once within a window", [], function* (test) {
	test.open("1 second");
	yield* eventually(() => {
		expect(test.status().connection).toBe("live");
		expect(test.body(1)).toBe("First");
		expect(test.body(2)).toBe("Second");
		expect(test.waiting(1)).toBe(false);
		expect(test.waiting(2)).toBe(false);
		expect(test.list().map(({ id }) => id)).toEqual([1, 2]);
	});
	const burstSize = 50;
	const before = test.reads();
	yield* test.holdWindow;
	for (let commit = 1; commit <= burstSize; commit += 1) {
		yield* test.edit(1, `Commit ${commit}`);
	}
	yield* test.waitForHints(burstSize);
	expect(test.received()).toBe(burstSize);
	expect(test.reads()).toEqual(before);
	yield* test.advanceWindow("1 second");
	yield* eventually(() => {
		expect(test.body(1)).toBe("Commit 50");
		expect(test.list().find(({ id }) => id === 1)?.body).toBe("Commit 50");
	});
	expect(test.reads().slice(before.length).sort()).toEqual(["get:1", "list"]);
	expect(test.body(2)).toBe("Second");
});

postgresLive.it("commits during a refetch wait for it to settle then fetch the newest value once", [], function* (test) {
	test.open();
	yield* eventually(() => {
		expect(test.body(1)).toBe("First");
		expect(test.status().connection).toBe("live");
		expect(test.waiting(1)).toBe(false);
	});
	const before = test.reads().filter((read) => read === "get:1").length;
	const gate = yield* Deferred.make<void>();
	yield* test.gateReads(Deferred.await(gate));
	yield* test.edit(1, "In flight");
	yield* eventually(() => expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 1));
	const commitsDuringRefetch = 10;
	for (let commit = 1; commit <= commitsDuringRefetch; commit += 1) {
		yield* test.edit(1, `Newest ${commit}`);
	}
	yield* eventually(() => expect(test.received()).toBe(commitsDuringRefetch + 1));
	yield* Effect.sleep("60 millis");
	expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 1);
	expect(test.body(1)).toBe("First");
	yield* test.gateReads(Effect.void);
	yield* Deferred.succeed(gate, undefined);
	yield* eventually(() => expect(test.body(1)).toBe("Newest 10"));
	expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 2);
});

postgresLive.it("a zero window refetches once per hint and interrupts an in-flight read", [], function* (test) {
	test.open(0);
	yield* eventually(() => {
		expect(test.body(1)).toBe("First");
		expect(test.status().connection).toBe("live");
		expect(test.waiting(1)).toBe(false);
	});
	const before = test.reads().filter((read) => read === "get:1").length;
	const gate = yield* Deferred.make<void>();
	yield* test.gateReads(Deferred.await(gate));
	for (let commit = 1; commit <= 5; commit += 1) {
		yield* test.edit(1, `Commit ${commit}`);
		yield* eventually(() => expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + commit));
	}
	yield* test.gateReads(Effect.void);
	yield* test.edit(1, "Latest without waiting");
	yield* eventually(() => expect(test.body(1)).toBe("Latest without waiting"));
	expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 6);
	yield* Deferred.succeed(gate, undefined);
});

postgresLive.it("reconnecting reconciles unrelated items immediately even with a long window", [], function* (test) {
	test.open("1 second");
	yield* eventually(() => {
		expect(test.body(1)).toBe("First");
		expect(test.body(2)).toBe("Second");
		expect(test.waiting(2)).toBe(false);
		expect(test.status().connection).toBe("live");
	});
	const before = test.reads().filter((read) => read === "get:2").length;
	yield* test.edit(1, "Before reconnect");
	yield* test.disconnect();
	yield* eventually(() => {
		expect(test.body(1)).toBe("Before reconnect");
		expect(test.reads().filter((read) => read === "get:2")).toHaveLength(before + 1);
	});
});

postgresLive.it("pausing defers an in-flight follow-up until full reconciliation on resume", [], function* (test) {
	test.open();
	yield* eventually(() => {
		expect(test.body(1)).toBe("First");
		expect(test.status().connection).toBe("live");
		expect(test.waiting(1)).toBe(false);
	});
	const before = test.reads().filter((read) => read === "get:1").length;
	const gate = yield* Deferred.make<void>();
	yield* test.gateReads(Deferred.await(gate));
	yield* test.edit(1, "Fetching");
	yield* eventually(() => expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 1));
	yield* test.edit(1, "Latest while paused");
	yield* Effect.sleep("60 millis");
	test.pause(true);
	yield* test.gateReads(Effect.void);
	yield* Deferred.succeed(gate, undefined);
	yield* eventually(() => expect(test.waiting(1)).toBe(false));
	expect(test.body(1)).toBe("Fetching");
	expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 1);
	test.resume();
	expect(test.body(1)).toBe("Fetching");
	test.pause(false);
	yield* eventually(() => expect(test.body(1)).toBe("Latest while paused"));
	expect(test.reads().filter((read) => read === "get:1")).toHaveLength(before + 2);
});

postgresLive.it("serialized query atoms keep their HTTP values across live refresh and hydration", [], function* (test) {
	test.open();
	const query = test.serialized();
	test.mount(query);
	yield* eventually(() => expect(AsyncResult.getOrElse(test.registry.get(query), () => undefined)?.body).toBe("First"));
	yield* test.edit(1, "Saved for reload");
	yield* eventually(() => expect(AsyncResult.getOrElse(test.registry.get(query), () => undefined)?.body).toBe("Saved for reload"));
	test.restore();
	expect(AsyncResult.getOrElse(test.registry.get(query), () => undefined)?.body).toBe("Saved for reload");
});

postgresLive.it("a query expires at its configured idle lifetime and reads the current HTTP value", [], function* (test) {
	const query = test.shortLived();
	const release = test.mount(query);
	yield* eventually(() => expect(AsyncResult.getOrElse(test.registry.get(query), () => undefined)?.body).toBe("First"));
	release();
	yield* eventually(() => expect(test.registry.getNodes().has(query)).toBe(false));
	yield* test.edit(1, "After expiry");
	test.mount(query);
	yield* eventually(() => expect(AsyncResult.getOrElse(test.registry.get(query), () => undefined)?.body).toBe("After expiry"));
});
