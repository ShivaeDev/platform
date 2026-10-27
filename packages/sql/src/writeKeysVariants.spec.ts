import { Effect } from "effect";
import { expect } from "vitest";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { hasBucketCopySource, hasBucketRows, writeKeys } from "#test/writeKeysStory.ts";

for (const operation of [
	"updateVoid",
	"upsert",
	"upsertMany",
	"conditionalUpsert",
	"conditionalUpsertMany",
	"versionedUpdate",
	"versionedUpdateVoid",
] as const) {
	writeKeys.it(`${operation} announces both sides of a bucket move`, [hasBucketRows(true)], function* (test) {
		const { rows, versioned, keys } = test.bucketRows();
		const input = { id: 1, listId: 2, owner: "bob", slug: "note", version: 0 };
		const settings = { updateColumns: ["listId", "owner"] } as const;
		const action = {
			conditionalUpsert: () => rows.upsert(input, { ...settings, updateWhere: { listId: 1 } }),
			conditionalUpsertMany: () => rows.upsertMany([input], { ...settings, updateWhere: { listId: 1 } }),
			updateVoid: () => rows.updateVoid(input),
			upsert: () => rows.upsert(input, settings),
			upsertMany: () => rows.upsertMany([input], settings),
			versionedUpdate: () => versioned.update(input),
			versionedUpdateVoid: () => versioned.updateVoid(input),
		}[operation];
		yield* action().pipe(Effect.asVoid, test.observePublication);
		expect(test.publishedKeys().sort()).toEqual(
			[
				...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.listId(2), keys.bucket.owner("alice"), keys.bucket.owner("bob")]),
			].sort(),
		);
	});
}

for (const operation of ["insertVoid", "insertMany", "insertOrIgnore", "versionedInsertVoid", "versionedInsertOrIgnore"] as const) {
	writeKeys.it(`${operation} announces each inserted record and its buckets`, [hasBucketRows(true)], function* (test) {
		const { rows, versioned, keys } = test.bucketRows();
		const input = { listId: 2, owner: "bob", slug: "second" };
		const action = {
			insertMany: () => rows.insertMany([input]),
			insertOrIgnore: () => rows.insertOrIgnore(input),
			insertVoid: () => rows.insertVoid(input),
			versionedInsertOrIgnore: () => versioned.insertOrIgnore(input),
			versionedInsertVoid: () => versioned.insertVoid(input),
		}[operation];
		yield* action().pipe(Effect.asVoid, test.observePublication);
		expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(2), keys.bucket.listId(2), keys.bucket.owner("bob")])].sort());
	});
}

writeKeys.it("versioned deletes announce the old buckets without decoding a result row", [hasBucketRows(true)], function* (test) {
	const { versioned, keys } = test.bucketRows();
	yield* versioned.delete(1, 0).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort());
});

writeKeys.it("removing a nullable bucket value still announces the old bucket", [hasBucketRows(true)], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* rows.updateVoid({ id: 1, listId: null, owner: "alice", slug: "note", version: 0 }).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort());
});

writeKeys.it("recording only a table cannot cover a raw write beside a repository write", [hasBucketRows()], function* (test) {
	const { rows, tableName } = test.bucketRows();
	const failure = yield* test
		.withChangeCoverage(
			Effect.gen(function* () {
				yield* rows.insert({ listId: 1, owner: "alice", slug: "repository" });
				yield* test.sql`insert into ${test.sql(tableName)} ("listId", owner, slug) values ('2', 'bob', 'raw')`;
				yield* test.invalidateOnCommit([tableName]);
			}),
		)
		.pipe(Effect.flip);
	expect(failure).toMatchObject({ _tag: "UnannouncedWrites", tables: [tableName] });
	expect(yield* rows.findMany()).toEqual([]);
});

writeKeys.it("coverage accepts repository record and bucket declarations", [hasBucketRows()], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* test.withChangeCoverage(rows.insert({ listId: 1, owner: "alice", slug: "covered" })).pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(1), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort());
});

writeKeys.it("a bulk insert keeps every record key and only its declared buckets beyond 1000 rows", [hasBucketRows()], function* (test) {
	const { rows, keys } = test.bucketRows();
	yield* test.watch("list 1", [keys.bucket.listId(1)]);
	yield* test.watch("list 2", [keys.bucket.listId(2)]);
	const inserted = yield* rows
		.insertMany(Array.from({ length: 1001 }, (_, index) => ({ listId: 1, owner: "alice", slug: `note-${index}` })))
		.pipe(test.observePublication);
	expect(test.publishedKeys().sort()).toEqual(
		[...invalidationKeys([...inserted.map(({ id }) => keys.item(id)), keys.bucket.listId(1), keys.bucket.owner("alice")])].sort(),
	);
	expect(test.refreshed()).toEqual(["list 1"]);
});

for (const operation of ["insertFromSelect", "insertFromSelectOrIgnore"] as const) {
	writeKeys.it(`${operation} announces the selected row's generated key and buckets`, [hasBucketRows(), hasBucketCopySource()], function* (test) {
		const { rows, source, keys } = test.bucketRows();
		yield* rows[operation](source.select(), { listId: "listId", owner: "owner", slug: "slug" }).pipe(test.observePublication);
		expect(test.publishedKeys().sort()).toEqual([...invalidationKeys([keys.item(1), keys.bucket.listId(2), keys.bucket.owner("bob")])].sort());
	});
}
