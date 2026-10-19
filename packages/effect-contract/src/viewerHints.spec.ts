import { Effect } from "effect";
import { expect } from "vitest";
import type { LiveHint } from "#live.ts";
import { eventually } from "#test/eventually.ts";
import { notes } from "#test/viewerEngine.ts";
import { viewerStory } from "#test/viewerStory.ts";

viewerStory.it("contract-typed clients receive changed keys only for rows their viewer may query", [], function* ({ get, rename, watch, resync }) {
	const alice: LiveHint[] = [];
	const bob: LiveHint[] = [];
	expect(yield* get("alice", 1)).toMatchObject({ id: 1, title: "One" });
	expect(yield* get("bob", 1).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
	yield* watch("alice", [notes.item(1)], alice).pipe(Effect.forkScoped);
	yield* watch("bob", [notes.item(1)], bob).pipe(Effect.forkScoped);
	yield* eventually(() => {
		expect(alice).toEqual([{ _tag: "Resync" }]);
		expect(bob).toEqual([{ _tag: "Resync" }]);
	});
	yield* rename("alice", 1, "Changed");
	yield* eventually(() => expect(alice.at(-1)).toEqual({ _tag: "Changed", keys: [notes.item(1)] }));
	yield* resync();
	yield* eventually(() => {
		expect(bob).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]);
		expect(alice.at(-1)).toEqual({ _tag: "Resync" });
	});
});

viewerStory.it("the contract's middleware rejects a change subscription without a session", [], function* ({ watch }) {
	expect(yield* watch(undefined, [notes.item(1)], []).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
});

viewerStory.it("both viewers receive allowed list hints while the private row key stays filtered", [], function* (test) {
	const alice: LiveHint[] = [];
	const bob: LiveHint[] = [];
	expect(yield* test.list("alice")).toMatchObject([{ id: 1 }]);
	expect(yield* test.list("bob")).toEqual([]);
	const keys = [notes.item(1), notes.list];
	yield* test.watch("alice", keys, alice).pipe(Effect.forkScoped);
	yield* test.watch("bob", keys, bob).pipe(Effect.forkScoped);
	yield* eventually(() => {
		expect(alice).toEqual([{ _tag: "Resync" }]);
		expect(bob).toEqual([{ _tag: "Resync" }]);
	});
	yield* test.rename("alice", 1, "Changed");
	yield* eventually(() => {
		expect(alice.at(-1)).toEqual({ _tag: "Changed", keys: [notes.item(1), notes.list] });
		expect(bob.at(-1)).toEqual({ _tag: "Changed", keys: [notes.list] });
	});
});
