import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { preferences } from "#test/sessionContract.ts";
import { sessionStory } from "#test/sessionStory.ts";

sessionStory.it(
	"self-only reads and writes refresh their owner's item and list after success, including calls from another runtime",
	[],
	function* (test) {
		const alice = test.watch("alice", "self");
		const list = test.watch("alice", "list");
		const other = test.watch("alice", 1);
		const bob = test.watch("bob", "self");
		yield* eventually(() => {
			expect(alice.value()).toBe("Alice");
			expect(bob.value()).toBe("Bob");
			expect(list.value()).toEqual(["Alice"]);
			expect(other.value()).toBe("Alice");
		});
		yield* test.saveFromOtherRuntime("Changed");
		yield* eventually(() => {
			expect(alice.value()).toBe("Changed");
			expect(list.value()).toEqual(["Changed"]);
		});
		const initialAndRefresh = 2;
		expect(test.readCount("alice", "self")).toBe(initialAndRefresh);
		expect(test.readCount("alice", "list")).toBe(initialAndRefresh);
		const initialOnly = 1;
		expect(test.readCount("alice", "get:1")).toBe(initialOnly);
		expect(test.readCount("bob", "self")).toBe(initialOnly);
		expect(bob.value()).toBe("Bob");
	},
);

sessionStory.it("a rejected self-only write declares no invalidation", [], function* (test) {
	const alice = test.watch("alice", "self");
	yield* eventually(() => expect(alice.value()).toBe("Alice"));
	expect(yield* test.save("alice", "").pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });
	const initialOnly = 1;
	expect(test.readCount("alice", "self")).toBe(initialOnly);
	expect(alice.waiting()).toBe(false);
});

sessionStory.it("automatic query references deliver hints and reconcile only the owning registry", [], function* (test) {
	const alice = test.watch("alice", "self");
	const bob = test.watch("bob", "self");
	test.connect("alice");
	test.connect("bob");
	yield* eventually(() => {
		expect(test.subscriptions()).toEqual({ alice: [{ payload: undefined, query: "self" }], bob: [{ payload: undefined, query: "self" }] });
		expect(alice.value()).toBe("Alice");
		expect(bob.value()).toBe("Bob");
		expect(alice.waiting() || bob.waiting()).toBe(false);
	});
	const before = test.readCount("bob", "self");
	yield* test.store("alice", "Hinted");
	yield* test.announce("alice", [preferences.item(0)]);
	yield* eventually(() => expect(alice.value()).toBe("Hinted"));
	expect(test.readCount("bob", "self")).toBe(before);
	expect(bob.value()).toBe("Bob");
	const aliceBeforeResync = test.readCount("alice", "self");
	const bobBeforeResync = test.readCount("bob", "self");
	yield* test.store("alice", "Reconciled");
	yield* test.resync();
	yield* eventually(() => {
		expect(alice.value()).toBe("Reconciled");
		expect(bob.waiting()).toBe(false);
		expect(test.readCount("alice", "self")).toBe(aliceBeforeResync + 1);
		expect(test.readCount("bob", "self")).toBe(bobBeforeResync + 1);
	});
	expect(bob.value()).toBe("Bob");
});

sessionStory.it("unmounted queries leave the tracked references and registry disposal releases subscriptions", [], function* (test) {
	const self = test.watch("alice", "self");
	const item = test.watch("alice", 1);
	test.connect("alice");
	yield* eventually(() =>
		expect(test.subscriptions().alice).toEqual([
			{ payload: undefined, query: "self" },
			{ payload: { id: 1 }, query: "get" },
		]),
	);
	self.release();
	yield* eventually(() => expect(test.subscriptions().alice).toEqual([{ payload: { id: 1 }, query: "get" }]));
	item.release();
	yield* eventually(() => expect(test.subscriptions()).toEqual({}));
	test.watch("alice", "self");
	yield* eventually(() => expect(test.subscriptions().alice).toEqual([{ payload: undefined, query: "self" }]));
	test.dispose("alice");
	yield* eventually(() => expect(test.subscriptions()).toEqual({}));
});

sessionStory.it("session contracts cannot bind without an owning registry", [], (test) => {
	expect(() => test.bindWithoutOwner()).toThrow("requires its owning registry");
});

sessionStory.it("reusing a command effect performs each write through the owner", [], function* (test) {
	const alice = test.watch("alice", "self");
	yield* eventually(() => expect(alice.value()).toBe("Alice"));
	const save = test.save("alice", "Saved");
	yield* save;
	yield* eventually(() => expect(alice.value()).toBe("Saved"));
	yield* test.store("alice", "Changed elsewhere");
	yield* save;
	yield* eventually(() => expect(alice.value()).toBe("Saved"));
	const initialAndTwoSaves = 3;
	expect(test.readCount("alice", "self")).toBe(initialAndTwoSaves);
});

sessionStory.it("query registration and live coordination reject another registry", [], (test) => {
	expect(() => test.readInOtherRegistry()).toThrow("belongs to its binding registry");
	expect(() => test.connectInOtherRegistry()).toThrow("belongs to its binding registry");
});
