import { Effect, SubscriptionRef } from "effect";
import { expect } from "vitest";
import { documents } from "#test/modulePolicies.ts";
import { modulePolicyStory } from "#test/modulePolicyStory.ts";

modulePolicyStory.it("merged module policies allow their own reads and deny other viewers and unclaimed keys", [], function* (test) {
	expect(yield* test.readDocuments("alice", ["one/a"])).toEqual(["First document"]);
	expect(yield* test.readDocuments("bob", ["one/a"]).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
	expect(yield* test.readTasks("alice", "alice")).toEqual(["Review first document"]);
	expect(yield* test.readTasks("bob", "alice").pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
	expect(yield* test.unclaimed().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
});

modulePolicyStory.it("a policy receives the viewer argument and none for an anonymous caller", [], function* (test) {
	yield* test.readDocuments("alice", ["one/a"]);
	expect(yield* test.readDocuments(undefined, ["one/a"]).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
	expect(test.viewers()).toEqual([{ id: "alice" }, undefined]);
	expect(yield* test.mySpaces("alice", "alice")).toEqual(["one"]);
	expect(yield* test.mySpaces("alice", "bob").pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
});

modulePolicyStory.it("query key checks use one native resolver batch for a space", [], function* (test) {
	const ids = ["one/a", "one/b", "one/c"];
	expect(yield* test.readDocuments("alice", ids)).toEqual(["First document", "Second document", "Third document"]);
	expect(test.batches()).toEqual([ids.map((id) => ({ key: documents.item(id), space: "one", viewer: "alice" }))]);
});

modulePolicyStory.it("hint filtering uses one native resolver batch and omits another space's key", [], function* (test) {
	const ids = ["one/a", "one/b", "one/c"];
	const keys = ids.map(documents.item);
	const listener = yield* test.listen("alice", [...ids, "two/a"]);
	yield* test.publish([...keys, documents.item("two/a")]);
	expect(yield* test.heard(listener, keys)).toBe(true);
	expect(yield* SubscriptionRef.get(listener.hints)).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys }]);
	expect(test.batches()).toEqual([
		ids.map((id) => ({ key: documents.item(id), space: "one", viewer: "alice" })),
		[{ key: documents.item("two/a"), space: "two", viewer: "alice" }],
	]);
});
