import { expect } from "vitest";
import { distinctDetails, jsonbFilters } from "#test/jsonbFilters.ts";

const cases = [
	{ details: null, ids: [1, 7], name: "null matches SQL NULL rather than JSON null" },
	{ details: { gt: 7 }, ids: [3], name: "an object with gt matches its encoded JSON value" },
	{ details: { in: [7] }, ids: [5], name: "an object with in matches its encoded JSON value" },
	{ details: { gt: 7, in: [7] }, ids: [6], name: "an object with both gt and in matches its entire encoded JSON value" },
] as const;

for (const { details, ids, name } of cases) {
	jsonbFilters.it(`reads: ${name}`, [distinctDetails()], function* ({ findProfiles }) {
		const found = yield* findProfiles({ details });

		expect(found).toEqual(ids.map((id) => ({ id })));
	});

	jsonbFilters.it(`counts: ${name}`, [distinctDetails()], function* ({ countProfiles }) {
		const count = yield* countProfiles({ details });

		expect(count).toBe(ids.length);
	});

	jsonbFilters.it(`deletes: ${name}`, [distinctDetails()], function* ({ deleteProfiles, remainingProfiles }) {
		yield* deleteProfiles({ details });

		expect(yield* remainingProfiles()).toEqual([1, 2, 3, 4, 5, 6, 7].filter((id) => !ids.some((matched) => matched === id)).map((id) => ({ id })));
	});
}

jsonbFilters.it(
	"an in list rejected by the value schema still matches a list of encoded JSON objects",
	[distinctDetails()],
	function* ({ findProfiles }) {
		const found = yield* findProfiles({ details: { in: [{ gt: 7 }, { in: [7] }] } });

		expect(found).toEqual([{ id: 3 }, { id: 5 }]);
	},
);
