import { expect } from "vitest";
import { keyStory, rows } from "#test/keyStory.ts";

keyStory.it("committed record and bucket keys wake their readers and leave other buckets quiet", [], function* (test) {
	yield* test.watch("record one", [rows.item(1)]);
	yield* test.watch("alice", [rows.bucket.userId("alice")]);
	yield* test.watch("bob", [rows.bucket.userId("bob")]);
	yield* test.watch("list 42", [rows.bucket.listId(42)]);
	const transaction = yield* test.open();
	yield* transaction.provide(test.record([rows.item(1), rows.bucket.userId("alice"), rows.bucket.listId(42)]));
	expect(test.refreshed()).toEqual([]);
	yield* transaction.settle("committed");
	expect(test.refreshed()).toEqual(["record one", "alice", "list 42"]);
});
