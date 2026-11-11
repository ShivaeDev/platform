import { expect } from "vitest";
import { readKeys } from "#test/readKeys.ts";

const SENDS = "sends its statement";

readKeys.it("findMany pinning two owners and 500 days listens on the 1,000 owner-day tuples, at the cap", [], function* ({ read }) {
	const log = yield* read({ call: "findDiaryDays", days: 500, owners: ["alice", "bob"] });

	const tuples = ["alice", "bob"].flatMap((owner) => Array.from({ length: 500 }, (_, index) => `ownerDay ["${owner}","${index + 1}"]`));
	expect(log).toEqual([`listens on ${tuples.join(", ")}`, SENDS]);
});

readKeys.it(
	"findMany pinning two owners and 501 days, 1,002 owner-day tuples over the cap, listens on the two owner buckets",
	[],
	function* ({ read }) {
		const log = yield* read({ call: "findDiaryDays", days: 501, owners: ["alice", "bob"] });

		expect(log).toEqual(['listens on ownerId "alice", ownerId "bob"', SENDS]);
	},
);

readKeys.it("findMany pinning 1,001 owners, over the cap, listens on the table", [], function* ({ read }) {
	const log = yield* read({ call: "findDiaryOwners", owners: 1001 });

	expect(log).toEqual(["listens on the table", SENDS]);
});
