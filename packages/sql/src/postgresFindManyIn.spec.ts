import { BigDecimal } from "effect";
import { expect } from "vitest";
import { queries } from "#test/queries.ts";

queries.it("findMany with an in list reads the samples whose ids are in the list", [], function* ({ findSamples, saveSamples }) {
	yield* saveSamples([
		{ id: 1, values: [10] },
		{ id: 2, values: [20] },
		{ id: 3, values: [30] },
	]);

	const found = yield* findSamples({ orderBy: { direction: "asc", field: "id" }, select: ["id"], where: { id: { in: [1, 3] } } });

	expect(found).toEqual([{ id: 1 }, { id: 3 }]);
});

queries.it(
	"an in list combines with equality on an array field, so only samples matching both are read",
	[],
	function* ({ findSamples, saveSamples }) {
		yield* saveSamples([
			{ id: 1, values: [10] },
			{ id: 2, values: [20] },
			{ id: 3, values: [10] },
			{ id: 4, values: [10] },
		]);

		const found = yield* findSamples({ orderBy: { direction: "asc", field: "id" }, where: { id: { in: [1, 2, 3] }, values: [10] } });

		expect(found).toEqual([
			{ id: 1, values: [10] },
			{ id: 3, values: [10] },
		]);
	},
);

queries.it("an empty in list reads no samples", [], function* ({ findSamples, saveSamples }) {
	yield* saveSamples([{ id: 1, values: [] }]);

	const found = yield* findSamples({ where: { id: { in: [] } } });

	expect(found).toEqual([]);
});

queries.it(
	"equality with an empty array reads the sample whose array is empty instead of treating it as an empty list",
	[],
	function* ({ findSamples, saveSamples }) {
		yield* saveSamples([
			{ id: 1, values: [] },
			{ id: 2, values: [10] },
		]);

		const found = yield* findSamples({ where: { values: [] } });

		expect(found).toEqual([{ id: 1, values: [] }]);
	},
);

queries.it("each in list value passes through the decimal field's codec", [], function* ({ findPayments, savePayments }) {
	const amount = BigDecimal.fromStringUnsafe;
	yield* savePayments([{ amount: amount("9007199254740993.123456789012") }, { amount: amount("42.125") }, { amount: amount("99.5") }]);

	const found = yield* findPayments({
		orderBy: { direction: "asc", field: "id" },
		select: ["amount"],
		where: { amount: { in: [amount("9007199254740993.123456789012"), amount("42.125")] } },
	});

	expect(found).toEqual([{ amount: "decimal 9007199254740993.123456789012" }, { amount: "decimal 42.125" }]);
});
