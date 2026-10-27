import { BigDecimal } from "effect";
import { expect } from "vitest";
import { input } from "#test/postgresCodecs.ts";
import { hasArraySamples } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";

postgres.it("findMany matches several IDs from a list", [hasArraySamples()], function* ({ arraySamples }) {
	const { samples } = arraySamples();
	yield* samples.insertMany([
		{ id: 1, values: [10] },
		{ id: 2, values: [20] },
		{ id: 3, values: [30] },
	]);
	expect(yield* samples.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["id"], where: { id: { in: [1, 3] } } })).toEqual([
		{ id: 1 },
		{ id: 3 },
	]);
});

postgres.it("list entries combine with equality on an array field", [hasArraySamples()], function* ({ arraySamples }) {
	const { samples } = arraySamples();
	yield* samples.insertMany([
		{ id: 1, values: [10] },
		{ id: 2, values: [20] },
		{ id: 3, values: [10] },
		{ id: 4, values: [10] },
	]);
	expect(yield* samples.findMany({ orderBy: { direction: "asc", field: "id" }, where: { id: { in: [1, 2, 3] }, values: [10] } })).toEqual([
		{ id: 1, values: [10] },
		{ id: 3, values: [10] },
	]);
});

postgres.it("an empty list matches no rows", [hasArraySamples()], function* ({ arraySamples }) {
	const { samples } = arraySamples();
	yield* samples.insert({ id: 1, values: [] });
	expect(yield* samples.findMany({ where: { id: { in: [] } } })).toEqual([]);
	expect(yield* samples.findMany({ where: { values: [] } })).toEqual([{ id: 1, values: [] }]);
});

postgres.it("every list value passes through its field codec", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const first = yield* payments.insert(input);
	const second = yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("42.125") });
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("99.5") });
	expect(
		yield* payments.findMany({
			orderBy: { direction: "asc", field: "id" },
			select: ["id"],
			where: { amount: { in: [first.amount, second.amount] } },
		}),
	).toEqual([{ id: first.id }, { id: second.id }]);
});
