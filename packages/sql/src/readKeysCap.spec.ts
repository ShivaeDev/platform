import { expect } from "vitest";
import { readKeys } from "#test/readKeys.ts";

const SENDS = "sends its statement";

function range(count: number) {
	return Array.from({ length: count }, (_, index) => index + 1);
}

function ownersAndDays(days: number) {
	return { day: { in: range(days) }, ownerId: { in: ["alice", "bob"] } };
}

readKeys.it("findMany pinning two owners and 500 days listens on the 1,000 owner-day tuples, at the cap", [], function* ({ read }) {
	const log = yield* read({ call: "findDiaryEntries", where: ownersAndDays(500) });

	const tuples = ["alice", "bob"].flatMap((owner) => range(500).map((day) => `ownerDay ["${owner}","${day}"]`));
	expect(log).toEqual([`listens on ${tuples.join(", ")}`, SENDS]);
});

readKeys.it(
	"findMany pinning two owners and 501 days, 1,002 owner-day tuples over the cap, listens on the two owner buckets",
	[],
	function* ({ read }) {
		const log = yield* read({ call: "findDiaryEntries", where: ownersAndDays(501) });

		expect(log).toEqual(['listens on ownerId "alice", ownerId "bob"', SENDS]);
	},
);

readKeys.it("findMany pinning 1,001 owners, over the cap, listens on the table", [], function* ({ read }) {
	const log = yield* read({ call: "findDiaryEntries", where: { ownerId: { in: range(1001).map((owner) => `owner ${owner}`) } } });

	expect(log).toEqual(["listens on the table", SENDS]);
});
