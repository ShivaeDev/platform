import { expect } from "vitest";
import { ID_BEYOND_NUMBER } from "#test/changeKeysVerbs.ts";
import { type MultiColumnKey, type Read, readKeys } from "#test/readKeys.ts";

const SENDS = "sends its statement";

const cases: readonly { readonly claim: string; readonly read: Read; readonly expected: string }[] = [
	{ claim: "findById listens on its row", expected: "record 1", read: { call: "findById", id: 1 } },
	{
		claim: "findOne by id and a bucket listens on the row, which a move out of the bucket still announces",
		expected: "record 1",
		read: { call: "findOne", where: { id: 1, owner: "alice" } },
	},
	{ claim: "findMany by an id list listens on each row", expected: "record 1, record 2", read: { call: "findMany", where: { id: { in: [1, 2] } } } },
	{
		claim: "findMany by a bucket and another column listens on that bucket",
		expected: "listId 1",
		read: { call: "findMany", where: { listId: 1, slug: "draft" } },
	},
	{
		claim: "findMany pinning two buckets listens on the one pinned to fewer values",
		expected: 'owner "alice", owner "bob"',
		read: { call: "findMany", where: { listId: { in: [1, 2, 3] }, owner: { in: ["alice", "bob"] } } },
	},
	{ claim: "findMany without a filter listens on the table", expected: "the table", read: { call: "findMany" } },
	{
		claim: "findMany by a column that is not a bucket listens on the table",
		expected: "the table",
		read: { call: "findMany", where: { slug: "draft" } },
	},
	{ claim: "findMany by a null bucket listens on the table", expected: "the table", read: { call: "findMany", where: { listId: null } } },
	{ claim: "findMany comparing the id listens on the table", expected: "the table", read: { call: "findMany", where: { id: { gt: 1 } } } },
	{
		claim: "findMany matching a bucket with like listens on the table",
		expected: "the table",
		read: { call: "findMany", where: { owner: { like: "al%" } } },
	},
	{
		claim: "findMany by an empty id list, which matches no row, listens on nothing",
		expected: "nothing",
		read: { call: "findMany", where: { id: { in: [] } } },
	},
	{ claim: "count by a bucket listens on that bucket", expected: 'owner "alice"', read: { call: "count", where: { owner: "alice" } } },
	{ claim: "aggregate by a bucket listens on that bucket", expected: "listId 1", read: { call: "aggregate", where: { listId: 1 } } },
	{
		claim: "latestPerGroup by a bucket listens on that bucket",
		expected: 'owner "alice"',
		read: { call: "latestPerGroup", where: { owner: "alice" } },
	},
	{ claim: "a select statement by id listens on its row", expected: "record 1", read: { call: "select", where: { id: 1 } } },
	{
		claim: "findById with a composite id listens on the row key its writes announce, for a bigint beyond Number precision",
		expected: 'record ["cash","9007199254740993"]',
		read: { account: "cash", call: "findLedgerEntry", sequence: ID_BEYOND_NUMBER },
	},
	{
		claim: "findById with a composite id stored as text listens on the row key its writes announce",
		expected: 'record ["1","2"]',
		read: { call: "findOwnedRow", id: 1, ownerId: 2 },
	},
	{
		claim: "findMany pinning only part of a composite id listens on the table",
		expected: "the table",
		read: { call: "findOwnedRows", where: { id: 1 } },
	},
	{
		claim: "findMany pinning every column of a tuple bucket listens on that tuple rather than the owner bucket inside it",
		expected: 'ownerDay ["alice","1"]',
		read: { call: "findDiaryEntries", where: { day: 1, ownerId: "alice" } },
	},
	{
		claim: "findMany pinning a tuple's columns to lists listens on each tuple of their values, though the owner bucket inside it has fewer keys",
		expected: 'ownerDay ["alice","1"], ownerDay ["alice","2"], ownerDay ["bob","1"], ownerDay ["bob","2"]',
		read: { call: "findDiaryEntries", where: { day: { in: [1, 2] }, ownerId: { in: ["alice", "bob"] } } },
	},
	{
		claim: "findMany pinning only the owner of an owner-day tuple listens on the owner bucket",
		expected: 'ownerId "alice"',
		read: { call: "findDiaryEntries", where: { ownerId: "alice" } },
	},
	{
		claim: "findMany pinning the owner and a null day, which no tuple key announces, listens on the owner bucket",
		expected: 'ownerId "alice"',
		read: { call: "findDiaryEntries", where: { day: null, ownerId: "alice" } },
	},
	{
		claim: "findMany pinning the owner and a day list that holds null pins no day, so it listens on the owner bucket",
		expected: 'ownerId "alice"',
		read: { call: "findDiaryEntries", where: { day: { in: [1, null] }, ownerId: "alice" } },
	},
	{
		claim: "findMany pinning only the day of an owner-day tuple, which is no bucket itself, listens on the table",
		expected: "the table",
		read: { call: "findDiaryEntries", where: { day: 1 } },
	},
	{
		claim: "a raw read through readSql listens on the bucket and the row its parameters mark",
		expected: 'owner "alice", record 1',
		read: { call: "readSql", id: 1, owner: "alice" },
	},
];

for (const { claim, expected, read } of cases) {
	readKeys.it(`${claim} before it sends its statement, on a table with no rows`, [], function* ({ read: perform }) {
		const log = yield* perform(read);

		expect(log).toEqual([`listens on ${expected}`, SENDS]);
	});
}

const refusals: readonly { readonly key: MultiColumnKey; readonly refusal: string }[] = [
	{
		key: "a tuple bucket key",
		refusal:
			'readSql cannot bind the tuple bucket drafts.ownerSlug ["alice","draft"] as one parameter, because it spans several columns. Bind each column\'s value and declare the key in the query\'s reads.',
	},
	{
		key: "a composite row key",
		refusal:
			'readSql cannot bind the composite row drafts:["alice","draft"] as one parameter, because it spans several columns. Bind each column\'s value and declare the key in the query\'s reads.',
	},
];

for (const { key, refusal } of refusals) {
	readKeys.it(
		`readSql refuses ${key} typed as a plain key with a typed failure naming the key, before it records a key or sends its statement`,
		[],
		function* ({ read }) {
			const log = yield* read({ call: "readSqlBySlug", key });

			expect(log).toEqual([`refuses: ${refusal}`]);
		},
	);
}
