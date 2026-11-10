import { expect } from "vitest";
import { ID_BEYOND_NUMBER } from "#test/changeKeysVerbs.ts";
import { readKeys } from "#test/readKeys.ts";

type Verbs = Parameters<Parameters<typeof readKeys.it>[2]>[0];

const SENDS = "sends its statement";

const cases: readonly { readonly claim: string; readonly read: (verbs: Verbs) => ReturnType<Verbs["findMany"]>; readonly expected: string }[] = [
	{ claim: "findById listens on its row", expected: "record 1", read: ({ findById }) => findById(1) },
	{
		claim: "findOne by id and a bucket listens on the row, which a move out of the bucket still announces",
		expected: "record 1",
		read: ({ findOne }) => findOne({ id: 1, owner: "alice" }),
	},
	{ claim: "findMany by an id list listens on each row", expected: "record 1, record 2", read: ({ findMany }) => findMany({ id: { in: [1, 2] } }) },
	{
		claim: "findMany by a bucket and another column listens on that bucket",
		expected: "listId 1",
		read: ({ findMany }) => findMany({ listId: 1, slug: "draft" }),
	},
	{
		claim: "findMany pinning two buckets listens on the one pinned to fewer values",
		expected: 'owner "alice", owner "bob"',
		read: ({ findMany }) => findMany({ listId: { in: [1, 2, 3] }, owner: { in: ["alice", "bob"] } }),
	},
	{ claim: "findMany without a filter listens on the table", expected: "the table", read: ({ findMany }) => findMany() },
	{
		claim: "findMany by a column that is not a bucket listens on the table",
		expected: "the table",
		read: ({ findMany }) => findMany({ slug: "draft" }),
	},
	{ claim: "findMany by a null bucket listens on the table", expected: "the table", read: ({ findMany }) => findMany({ listId: null }) },
	{ claim: "findMany comparing the id listens on the table", expected: "the table", read: ({ findMany }) => findMany({ id: { gt: 1 } }) },
	{
		claim: "findMany matching a bucket with like listens on the table",
		expected: "the table",
		read: ({ findMany }) => findMany({ owner: { like: "al%" } }),
	},
	{
		claim: "findMany by an empty id list, which matches no row, listens on nothing",
		expected: "nothing",
		read: ({ findMany }) => findMany({ id: { in: [] } }),
	},
	{ claim: "count by a bucket listens on that bucket", expected: 'owner "alice"', read: ({ count }) => count({ owner: "alice" }) },
	{ claim: "aggregate by a bucket listens on that bucket", expected: "listId 1", read: ({ aggregate }) => aggregate({ listId: 1 }) },
	{
		claim: "latestPerGroup by a bucket listens on that bucket",
		expected: 'owner "alice"',
		read: ({ latestPerGroup }) => latestPerGroup({ owner: "alice" }),
	},
	{ claim: "a select statement by id listens on its row", expected: "record 1", read: ({ select }) => select({ id: 1 }) },
	{
		claim: "findById with a composite id listens on the row key its writes announce, for a bigint beyond Number precision",
		expected: 'record ["cash","9007199254740993"]',
		read: ({ findLedgerEntry }) => findLedgerEntry("cash", ID_BEYOND_NUMBER),
	},
	{
		claim: "findById with a composite id stored as text listens on the row key its writes announce",
		expected: 'record ["1","2"]',
		read: ({ findOwnedRow }) => findOwnedRow(1, 2),
	},
	{
		claim: "findMany pinning only part of a composite id listens on the table",
		expected: "the table",
		read: ({ findOwnedRows }) => findOwnedRows({ id: 1 }),
	},
];

for (const { claim, expected, read } of cases) {
	readKeys.it(`${claim} before it sends its statement, on a table with no rows`, [], function* (verbs) {
		const log = yield* read(verbs);

		expect(log).toEqual([`listens on ${expected}`, SENDS]);
	});
}
