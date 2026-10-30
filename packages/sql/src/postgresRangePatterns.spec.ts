import { BigDecimal, DateTime } from "effect";
import { expect } from "vitest";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { queries, sourceRows } from "#test/queries.ts";
import type { Payment, Sample } from "#test/queryModels.ts";

const bounds = [
	{ expected: [{ id: 2 }, { id: 3 }], name: "gt 1 and lt 4 exclude both ends", where: { id: { gt: 1, lt: 4 } } },
	{ expected: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], name: "gte 1 and lte 4 include both ends", where: { id: { gte: 1, lte: 4 } } },
	{ expected: [{ id: 3 }], name: "gt 2 and lte 3 include only the upper end", where: { id: { gt: 2, lte: 3 } } },
	{ expected: [{ id: 2 }], name: "gte 2 and lt 3 include only the lower end", where: { id: { gte: 2, lt: 3 } } },
] as const;

for (const { expected, name, where } of bounds) {
	queries.it(`numeric bounds ${name} of samples 1 to 4`, [], function* ({ findSamples, saveSamples }) {
		yield* saveSamples([1, 2, 3, 4].map((id) => ({ id, values: [id] })));

		const found = yield* findSamples({ orderBy: { direction: "asc", field: "id" }, select: ["id"], where });

		expect(found).toEqual(expected);
	});
}

const settled = ["2026-10-25T00:00:00.000Z", "2026-10-25T12:00:00.000Z", "2026-10-26T00:00:00.000Z"].map((value) => new Date(value));

queries.it(
	"Date bounds given with a -10:00 offset compare as UTC instants and read the payments of October 25 UTC",
	[],
	function* ({ findPayments, savePayments }) {
		yield* savePayments(settled.map((settledAt) => ({ "settled_at": settledAt })));

		const found = yield* findPayments({
			orderBy: { direction: "asc", field: "settled_at" },
			select: ["settled_at"],
			where: { "settled_at": { gte: new Date("2026-10-24T14:00:00-10:00"), lt: new Date("2026-10-26T00:00:00Z") } },
		});

		expect(found).toEqual([{ "settled_at": settled[0] }, { "settled_at": settled[1] }]);
	},
);

queries.it(
	"a DateTime.Utc bound encodes through a DateTime.Utc model field and reads the later payment",
	[],
	function* ({ findUtcPayments, savePayments }) {
		yield* savePayments(settled.map((settledAt) => ({ "settled_at": settledAt })));

		const found = yield* findUtcPayments({ select: ["settled_at"], where: { "settled_at": { gt: DateTime.makeUnsafe("2026-10-25T12:00:00Z") } } });

		expect(found).toEqual([{ "settled_at": "2026-10-26T00:00:00.000Z" }]);
	},
);

queries.it("bigint and decimal bounds beyond Number precision select the payments between them", [], function* ({ findPayments, savePayments }) {
	const amount = BigDecimal.fromStringUnsafe;
	yield* savePayments([
		{ amount: amount("9007199254740993.1"), sequence: 9007199254740993n },
		{ amount: amount("9007199254740993.2"), sequence: 9007199254740994n },
		{ amount: amount("9007199254740993.3"), sequence: 9007199254740995n },
	]);

	const found = yield* findPayments({
		orderBy: { direction: "asc", field: "sequence" },
		select: ["sequence"],
		where: {
			amount: { gte: amount("9007199254740993.1"), lt: amount("9007199254740993.3") },
			sequence: { gt: 9007199254740992n, lte: 9007199254740994n },
		},
	});

	expect(found).toEqual([{ sequence: 9007199254740993n }, { sequence: 9007199254740994n }]);
});

queries.it(
	"a like pattern combines with text bounds, an in list and equality, so only the note matching all of them is read",
	[],
	function* ({ findPayments, savePayments }) {
		yield* savePayments([{ note: "Run_a" }, { note: "Run_ab" }, { note: "run_a" }, { note: "Other" }, { note: "Run_b", sequence: 1n }]);

		const found = yield* findPayments({
			select: ["note"],
			where: { "due_on": "2026-09-30", note: { gte: "Run", like: "Run__", lt: "S" }, sequence: { in: [9007199254740993n] } },
		});

		expect(found).toEqual([{ note: "Run_a" }]);
	},
);

queries.it(
	"a pattern holding a quote and a SQL comment is bound as a parameter and matches only its literal note",
	[],
	function* ({ findPayments, savePayments }) {
		yield* savePayments([{ note: "Run_a" }, { note: "Run_' OR true --" }]);

		const found = yield* findPayments({ select: ["note"], where: { note: { like: "Run_' OR true --" } } });

		expect(found).toEqual([{ note: "Run_' OR true --" }]);
	},
);

queries.it("select applies a range and a pattern through their field codecs when copying sources", [sourceRows()], function* ({ copySelected }) {
	const copied = yield* copySelected({
		select: ["sourceKey", "displayName", "amount"],
		where: { amount: { gte: 20, lt: 40 }, displayName: { like: "sec%" } },
	});

	expect(copied).toEqual([expect.objectContaining({ amount: 20, copiedKey: 2, name: "second" })]);
});

const invalidOperands = [
	{ json: '{"sequence":{"gt":"9007199254740993"}}', name: "a text bound on a bigint field" },
	{ json: '{"settled_at":{"gte":"2026-10-25T00:00:00Z"}}', name: "a text bound on a Date field" },
	{ json: '{"note":{"like":42}}', name: "a numeric pattern" },
	{ json: '{"sequence":{"like":"9%"}}', name: "a pattern on a bigint field" },
	{ json: '{"note":{"lt":null}}', name: "a null bound" },
	{ json: '{"missing":{"gt":1}}', name: "a bound on an unknown field" },
];

for (const { json, name } of invalidOperands) {
	const where: FindManyFilter<typeof Payment> = JSON.parse(json);

	queries.it(`findMany rejects ${name} with a schema error`, [], function* ({ findPayments }) {
		const found = yield* findPayments({ where });

		expect(found).toBe("failed with a schema error");
	});

	queries.it(`select rejects ${name} with a schema error`, [], function* ({ selectPayments }) {
		const prepared = yield* selectPayments(where);

		expect(prepared).toBe("failed with a schema error");
	});
}

queries.it("findMany rejects a bound on an array field with a schema error", [], function* ({ findSamples }) {
	const where: FindManyFilter<typeof Sample> = JSON.parse('{"values":{"gt":[1]}}');

	const found = yield* findSamples({ where });

	expect(found).toBe("failed with a schema error");
});
