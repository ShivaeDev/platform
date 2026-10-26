import { BigDecimal } from "effect";
import { expect } from "vitest";
import { input } from "#test/postgresCodecs.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";

postgres.it("count returns a number for rows matching equality through field codecs", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	yield* payments.insert({ ...input, note: "paid" });
	const matching = [input, input];
	yield* payments.insertMany(matching);
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("42.125") });
	expect(yield* payments.count({ where: { amount: input.amount, note: null } })).toBe(matching.length);
});

postgres.it("count combines list entries with equality through field codecs", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const otherAmount = BigDecimal.fromStringUnsafe("42.125");
	const matching = [input, { ...input, amount: otherAmount }];
	yield* payments.insertMany(matching);
	yield* payments.insert({ ...input, amount: otherAmount, note: "paid" });
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("99.5") });
	expect(yield* payments.count({ where: { amount: { in: [input.amount, otherAmount] }, note: null } })).toBe(matching.length);
});

postgres.it("count returns zero for an empty table", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	expect(yield* payments.count()).toBe(0);
});

postgres.it("count without a filter counts every row", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const inserted = [input, { ...input, note: "paid" }, { ...input, amount: BigDecimal.fromStringUnsafe("42.125") }];
	yield* payments.insertMany(inserted);
	expect(yield* payments.count()).toBe(inserted.length);
	expect(yield* payments.count({})).toBe(inserted.length);
});
