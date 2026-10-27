import { Effect } from "effect";
import { expect } from "vitest";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { hasBucketRows, writeKeys } from "#test/writeKeysStory.ts";

writeKeys.it("an insert announces its generated record and only its own buckets after commit", [hasBucketRows()], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* test.watch("list 1", [keys.bucket.listId(1)]);
	yield* test.watch("list 2", [keys.bucket.listId(2)]);
	yield* test.watch("alice", [keys.bucket.owner("alice")]);
	yield* test.watch("bob", [keys.bucket.owner("bob")]);
	yield* test.watch("record", [keys.item(1)]);
	const row = yield* Effect.gen(function* () {
		const inserted = yield* rows.insert({ listId: 1, owner: "alice", slug: "note" });
		expect(test.refreshed()).toEqual([]);
		expect(test.publishedKeys()).toEqual([]);
		return inserted;
	}).pipe(test.transact({ onSqlError: (error) => error }), test.observePublication);
	expect(row).toMatchObject({ listId: 1, owner: "alice", slug: "note" });
	expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(row.id), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort());
	expect(test.refreshed().toSorted()).toEqual(["alice", "list 1", "record"]);
});

writeKeys.it("moving a record wakes its old and new buckets", [hasBucketRows(true)], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* test.watch("old list", [keys.bucket.listId(1)]);
	yield* test.watch("new list", [keys.bucket.listId(2)]);
	yield* test.watch("other list", [keys.bucket.listId(3)]);
	yield* rows.update({ id: 1, listId: 2, owner: "bob", slug: "note", version: 0 }).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual(
		[...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.listId(2), keys.bucket.owner("alice"), keys.bucket.owner("bob")])].sort(),
	);
	expect(test.refreshed().toSorted()).toEqual(["new list", "old list"]);
});

writeKeys.it("deleting a record announces the old row's record and buckets", [hasBucketRows(true)], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* rows.delete(1).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort());
	expect(yield* rows.findMany()).toEqual([]);
});

writeKeys.it("a rolled-back bucket move publishes nothing", [hasBucketRows(true)], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* test.watch("old list", [keys.bucket.listId(1)]);
	yield* test.watch("new list", [keys.bucket.listId(2)]);
	const result = yield* rows
		.update({ id: 1, listId: 2, owner: "bob", slug: "note", version: 0 })
		.pipe(Effect.andThen(Effect.fail("rollback")), test.transact({ onSqlError: (error) => error }), test.observePublication, Effect.result);
	expect(result).toMatchObject({ _tag: "Failure", failure: "rollback" });
	expect(test.publishedKeys()).toEqual([]);
	expect(test.refreshed()).toEqual([]);
	expect(yield* rows.findById(1)).toMatchObject({ listId: 1, owner: "alice" });
	const committed = yield* rows.insert({ listId: 2, owner: "bob", slug: "committed" }).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual(
		[...invalidationKeys([keys.item(committed.id), keys.bucket.listId(2), keys.bucket.owner("bob")])].sort(),
	);
	expect(test.refreshed()).toEqual(["new list"]);
});

writeKeys.it("raw writes must declare and record every affected record and bucket key", [hasBucketRows()], function* (test) {
	const { keys, tableName, rows } = test.bucketRows();
	const insert = test.sql`insert into ${test.sql(tableName)} ("listId", owner, slug) values ('1', 'alice', 'raw') returning id`;
	const undeclared = yield* test.withChangeCoverage(insert).pipe(Effect.flip);
	expect(undeclared).toMatchObject({ _tag: "UnannouncedWrites", tables: [tableName] });
	const declared = [keys.item(2), keys.bucket.listId(1), keys.bucket.owner("alice")];
	const missingBucket = yield* test
		.withChangeCoverage(Effect.andThen(insert, test.invalidateOnCommit(invalidationKeys([keys.item(2)]))), {
			covers: { [tableName]: declared },
		})
		.pipe(Effect.flip);
	expect(missingBucket).toMatchObject({ _tag: "UnannouncedWrites", tables: [tableName] });
	const actual = [keys.item(3), keys.bucket.listId(1), keys.bucket.owner("alice")];
	yield* test.withChangeCoverage(Effect.andThen(insert, test.invalidateOnCommit(invalidationKeys(actual))), { covers: { [tableName]: actual } });
	expect(yield* rows.findMany()).toMatchObject([{ id: 3, listId: 1, owner: "alice" }]);
});
