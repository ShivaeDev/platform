import { Effect } from "effect";
import { expect } from "vitest";
import type { LiveHint } from "#live.ts";
import { eventually } from "#test/eventually.ts";
import { notes } from "#test/viewerEngine.ts";
import { viewerStory } from "#test/viewerStory.ts";

viewerStory.it("a viewer watches their own record and bucket while another viewer is refused both", [], function* (test) {
	const alice: LiveHint[] = [];
	const bob: LiveHint[] = [];
	const queries = [
		{ payload: { id: 1 }, query: "get" },
		{ payload: { userId: "alice" }, query: "listFor" },
	] as const;
	expect(yield* test.get("alice", 1)).toMatchObject({ title: "One" });
	expect(yield* test.get("bob", 1).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
	for (const query of queries) {
		expect(yield* test.watch("bob", [query], bob).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
	}
	yield* test.watch("alice", queries, alice).pipe(Effect.forkScoped);
	yield* eventually(() => expect(alice).toEqual([{ _tag: "Resync" }]));
	yield* test.rename("alice", 1, "Changed");
	yield* eventually(() => expect(alice.at(-1)).toMatchObject({ _tag: "Changed", keys: [notes.item(1), notes.bucket.userId("alice")] }));
	expect(bob).toEqual([]);
});

viewerStory.it("a live query without a policy explains how to declare one", [], function* (test) {
	const page = yield* test.openUnprotectedPage("alice");
	yield* eventually(() =>
		expect(page.failure()).toMatchObject({ _tag: "MissingReadPolicy", message: expect.stringContaining("Declare a readPolicy") }),
	);
	expect(page.titles()).toEqual([]);
	expect(yield* test.watch("alice", [{ payload: undefined, query: "unprotected" }], []).pipe(Effect.result)).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "MissingReadPolicy", message: expect.stringContaining("Declare a readPolicy") },
	});
});

viewerStory.it("the session scopes my rows and extra list filters never narrow the bucket", [], function* (test) {
	expect(yield* test.list("alice", "One")).toMatchObject([{ id: 1 }]);
	expect(yield* test.list("bob")).toMatchObject([{ id: 2 }]);
	const hints: LiveHint[] = [];
	yield* test.watch("alice", [{ payload: { title: "One" }, query: "list" }], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* test.rename("alice", 3, "Still excluded");
	yield* eventually(() => expect(hints.at(-1)).toMatchObject({ _tag: "Changed", keys: [notes.bucket.userId("alice")] }));
	expect(yield* test.list("alice", "One")).toMatchObject([{ id: 1 }]);
});

viewerStory.it("a mounted filtered list reruns its authorized read after any row in its viewer bucket changes", [], function* (test) {
	const alice = yield* test.openPage("alice", "One");
	const bob = yield* test.openPage("bob");
	yield* eventually(() => {
		expect(alice.titles()).toEqual(["One"]);
		expect(bob.titles()).toEqual(["Two"]);
		expect(alice.status().connection).toBe("live");
		expect(bob.status().connection).toBe("live");
	});
	yield* test.rename("alice", 3, "One more");
	yield* eventually(() => expect(alice.titles()).toEqual(["One", "One more"]));
	expect(bob.titles()).toEqual(["Two"]);
});
