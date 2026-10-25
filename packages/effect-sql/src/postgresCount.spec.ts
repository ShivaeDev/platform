import { BigDecimal } from "effect";
import { expect } from "vitest";
import { input } from "#test/postgresCodecs.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";

postgres.it("count returns a number for rows matching equality through field codecs", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	yield* payments.insert({ ...input, note: "paid" });
	yield* payments.insert(input);
	yield* payments.insert(input);
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("42.125") });
	const paymentsWithMatchingAmountAndNoNote = 2;
	expect(yield* payments.count({ where: { amount: input.amount, note: null } })).toBe(paymentsWithMatchingAmountAndNoNote);
});

postgres.it("count combines list entries with equality through field codecs", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const otherAmount = BigDecimal.fromStringUnsafe("42.125");
	yield* payments.insert(input);
	yield* payments.insert({ ...input, amount: otherAmount });
	yield* payments.insert({ ...input, amount: otherAmount, note: "paid" });
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("99.5") });
	const paymentsWithListedAmountsAndNoNote = 2;
	expect(yield* payments.count({ where: { amount: { in: [input.amount, otherAmount] }, note: null } })).toBe(paymentsWithListedAmountsAndNoNote);
});

postgres.it("count returns zero for an empty table", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const emptyTableCount = 0;
	expect(yield* payments.count()).toBe(emptyTableCount);
});

postgres.it("count without a filter counts every row", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	yield* payments.insert(input);
	yield* payments.insert({ ...input, note: "paid" });
	yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("42.125") });
	const allPayments = 3;
	expect(yield* payments.count()).toBe(allPayments);
	expect(yield* payments.count({})).toBe(allPayments);
});
