import { Effect, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { notesStory, signedIn } from "#test/notesStory.ts";

notesStory.it(
	"queries register their declared read keys and commands invalidate item and list after success only",
	[signedIn()],
	function* ({ query, queryList, mount, rename, registry, reads }) {
		const one = query(1);
		const two = query(2);
		const list = queryList();
		mount(one);
		mount(two);
		mount(list);
		yield* eventually(() => expect([...reads()].sort()).toEqual(["get:1", "get:2", "list"]));
		const renamed = yield* Effect.result(rename(1, "Uno"));
		expect(Result.isSuccess(renamed)).toBe(true);
		yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.title).toBe("Uno"));
		yield* eventually(() => expect(reads().filter((read) => read === "list")).toHaveLength(2));
		expect(reads().filter((read) => read === "get:2")).toHaveLength(1);
		const rejected = yield* Effect.result(rename(2, ""));
		expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Invalid");
		yield* Effect.sleep("20 millis");
		expect(reads().filter((read) => read === "list")).toHaveLength(2);
		expect(reads().filter((read) => read === "get:2")).toHaveLength(1);
	},
);

notesStory.it(
	"result-dependent invalidation refreshes the item a command created",
	[signedIn()],
	function* ({ query, mount, create, registry, reads }) {
		const three = query(3);
		mount(three);
		yield* eventually(() => expect(AsyncResult.isFailure(registry.get(three))).toBe(true));
		expect(Result.isSuccess(yield* Effect.result(create("Three")))).toBe(true);
		yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(three), () => undefined)?.title).toBe("Three"));
		expect(reads().filter((read) => read === "get:3")).toHaveLength(2);
	},
);

notesStory.it("query run performs a one-off typed call without registering keys", [signedIn()], function* ({ get }) {
	const found = yield* Effect.result(get(2));
	expect(Result.isSuccess(found) && found.success.title).toBe("Two");
	const missing = yield* Effect.result(get(7));
	expect(Result.isFailure(missing) && missing.failure._tag).toBe("NoteMissing");
});
