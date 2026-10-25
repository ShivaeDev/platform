import { Effect } from "effect";
import { expect } from "vitest";
import type { LiveHint } from "#live.ts";
import { eventually } from "#test/eventually.ts";
import { notes } from "#test/viewerEngine.ts";
import { viewerStory } from "#test/viewerStory.ts";

viewerStory.it("a burst reuses one successful check per stream and key while queries still authorize afresh", [], function* (test) {
	const alice: LiveHint[] = [];
	const bob: LiveHint[] = [];
	yield* test.watch("alice", [{ payload: { id: 1 }, query: "get" }], alice).pipe(Effect.forkScoped);
	yield* test.watch("bob", [{ payload: { id: 1 }, query: "get" }], bob).pipe(Effect.forkScoped);
	yield* eventually(() => {
		expect(alice).toEqual([{ _tag: "Resync" }]);
		expect(bob).toEqual([{ _tag: "Resync" }]);
	});
	for (let index = 1; index <= 4; index += 1) {
		yield* test.rename("alice", 1, `Change ${index}`);
		yield* eventually(() => expect(alice).toHaveLength(index + 1));
	}
	expect(test.checks()).toEqual([
		{ key: notes.item(1), viewer: "alice" },
		{ key: notes.item(1), viewer: "bob" },
	]);
	expect(bob).toEqual([{ _tag: "Resync" }]);
	yield* test.policyOutage(true);
	expect(yield* test.get("alice", 1).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "PolicyUnavailable" } });
});

viewerStory.it("an application can disable hint memoisation", [], function* (test) {
	yield* test.memoWindow(0);
	const hints: LiveHint[] = [];
	yield* test.watch("alice", [{ payload: { id: 1 }, query: "get" }], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	for (let index = 1; index <= 3; index += 1) {
		yield* test.rename("alice", 1, `Change ${index}`);
		yield* eventually(() => expect(hints).toHaveLength(index + 1));
	}
	expect(test.checks()).toEqual(Array.from({ length: 3 }, () => ({ key: notes.item(1), viewer: "alice" })));
});

viewerStory.it("a false hint check does not schedule recovery checks", [], function* (test) {
	yield* test.memoWindow(0);
	const hints: LiveHint[] = [];
	yield* test.watch("bob", [{ payload: { id: 1 }, query: "get" }], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* test.rename("alice", 1, "Private change");
	yield* eventually(() => expect(test.checks()).toEqual([{ key: notes.item(1), viewer: "bob" }]));
	yield* Effect.sleep("1100 millis");
	expect(test.checks()).toEqual([{ key: notes.item(1), viewer: "bob" }]);
	expect(hints).toEqual([{ _tag: "Resync" }]);
});

viewerStory.it("a shorter memo window expires and rechecks the policy", [], function* (test) {
	yield* test.memoWindow("20 millis");
	const hints: LiveHint[] = [];
	yield* test.watch("alice", [{ payload: { id: 1 }, query: "get" }], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* test.rename("alice", 1, "First change");
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [notes.item(1)] }]));
	yield* Effect.sleep("30 millis");
	yield* test.policyOutage(true);
	yield* test.rename("alice", 1, "Expired check");
	yield* eventually(() => expect(test.checks()).toEqual(Array.from({ length: 2 }, () => ({ key: notes.item(1), viewer: "alice" }))));
	yield* test.resync();
	yield* eventually(() => expect(hints.at(-1)).toEqual({ _tag: "Resync" }));
	expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [notes.item(1)] }, { _tag: "Resync" }]);
});
