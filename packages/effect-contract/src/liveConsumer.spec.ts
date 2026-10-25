import { Deferred, Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { coalescing, liveNotesStory, liveSession, watchingNotes } from "#test/liveNotesStory.ts";

liveNotesStory.it(
	"refreshes affected item/list over native streaming HTTP while preserving the unrelated query",
	[liveSession(), watchingNotes()],
	function* (test) {
		yield* eventually(() => {
			expect(test.status().connection).toBe("live");
			const activeSubscriptions = 1;
			expect(test.active()).toBe(activeSubscriptions);
			expect([test.body(test.one), test.body(test.two)]).toEqual(["First", "Second"]);
			expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
				false,
				false,
				false,
			]);
		});
		const { one, two, list } = test;
		yield* eventually(() => expect(test.body(two)).toBe("Second"));
		const before = test.reads().filter((id) => id === "get:2").length;
		yield* test.edit(1, "Changed");
		yield* eventually(() => expect(test.body(one)).toBe("Changed"));
		yield* eventually(() => expect(AsyncResult.getOrElse(test.registry.get(list), () => []).find(({ id }) => id === 1)?.body).toBe("Changed"));
		expect(test.reads().filter((id) => id === "get:2")).toHaveLength(before);
	},
);
liveNotesStory.it("bounds paused hints and resyncs current source once resumed", [liveSession(), watchingNotes()], function* (test) {
	yield* eventually(() => {
		expect(test.status().connection).toBe("live");
		const activeSubscriptions = 1;
		expect(test.active()).toBe(activeSubscriptions);
		expect([test.body(test.one), test.body(test.two)]).toEqual(["First", "Second"]);
		expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
			false,
			false,
			false,
		]);
	});
	const { one } = test;
	test.pause(true);
	yield* test.edit(1, "While paused");
	yield* eventually(() => expect(test.status().pending).toBe(1));
	yield* test.resyncRepeatedly(300);
	yield* eventually(() => expect(test.status().pending).toBe(256));
	expect(test.body(one)).toBe("First");
	test.pause(false);
	yield* AtomRegistry.toStream(test.registry, one).pipe(
		Stream.filter((result) => AsyncResult.getOrElse(result, () => undefined)?.body === "While paused"),
		Stream.take(1),
		Stream.runDrain,
	);
	expect(test.body(one)).toBe("While paused");
	expect(test.status().pending).toBe(0);
});
liveNotesStory.it("retains successful data on typed read failure and reconciles on resume", [liveSession(), watchingNotes()], function* (test) {
	yield* eventually(() => {
		expect(test.status().connection).toBe("live");
		const activeSubscriptions = 1;
		expect(test.active()).toBe(activeSubscriptions);
		expect([test.body(test.one), test.body(test.two)]).toEqual(["First", "Second"]);
		expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
			false,
			false,
			false,
		]);
	});
	const { one } = test;
	yield* test.readOutage(true);
	yield* test.edit(1, "After outage");
	yield* eventually(() => expect(AsyncResult.isFailure(test.registry.get(one))).toBe(true));
	expect(test.body(one)).toBe("First");
	yield* test.readOutage(false);
	test.resume();
	yield* eventually(() => expect(test.body(one)).toBe("After outage"));
});
liveNotesStory.it(
	"resyncs missed source changes after a typed stream outage without duplicating subscriptions",
	[liveSession(), watchingNotes()],
	function* (test) {
		yield* eventually(() => {
			expect(test.status().connection).toBe("live");
			const activeSubscriptions = 1;
			expect(test.active()).toBe(activeSubscriptions);
			expect([test.body(test.one), test.body(test.two)]).toEqual(["First", "Second"]);
			expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
				false,
				false,
				false,
			]);
		});
		const { one } = test;
		yield* test.streamOutage(true);
		yield* test.disconnect();
		yield* eventually(() => expect(Option.isSome(test.status().failure)).toBe(true));
		expect(test.status().needsResync).toBe(true);
		expect(test.body(one)).toBe("First");
		yield* test.edit(1, "Missed while disconnected");
		yield* test.streamOutage(false);
		yield* eventually(() => expect(test.body(one)).toBe("Missed while disconnected"));
		expect(test.status().connection).toBe("live");
		expect(Option.isNone(test.status().failure)).toBe(true);
		expect(test.active()).toBe(1);
	},
);
liveNotesStory.it(
	"interrupts stale HTTP reads on invalidation and disposes the single stream subscription",
	[liveSession(), coalescing(0), watchingNotes()],
	function* (test) {
		yield* eventually(() => {
			expect(test.status().connection).toBe("live");
			const activeSubscriptions = 1;
			expect(test.active()).toBe(activeSubscriptions);
			expect([test.body(test.one), test.body(test.two)]).toEqual(["First", "Second"]);
			expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
				false,
				false,
				false,
			]);
		});
		const { one } = test;
		const gate = yield* Deferred.make<void>();
		yield* test.gateReads(Deferred.await(gate));
		const before = test.reads().length;
		yield* test.edit(1, "Older request");
		yield* eventually(() => expect(test.reads().length).toBeGreaterThan(before));
		yield* test.gateReads(Effect.void);
		yield* test.edit(1, "Newest request");
		yield* eventually(() => expect(test.body(one)).toBe("Newest request"));
		yield* Deferred.succeed(gate, undefined);
		yield* test.emit({ _tag: "Resync" });
		yield* eventually(() => expect(test.registry.get(one).waiting).toBe(false));
		expect(test.body(one)).toBe("Newest request");
		expect(test.connections()).toBe(1);
		test.dispose();
		yield* eventually(() => expect(test.active()).toBe(0));
	},
);
