import { BigDecimal } from "effect";
import { expect } from "vitest";
import { payment } from "#test/codecModels.ts";
import { codecs } from "#test/codecs.ts";

const otherAmount = BigDecimal.fromStringUnsafe("42.125");

codecs.it(
	"count matches equality on a precise amount and a null note through the field codecs",
	[],
	function* ({ countPayments, insertPayment, insertPayments }) {
		const matching = 2;
		yield* insertPayment({ note: "paid" });
		yield* insertPayments(matching);
		yield* insertPayment({ amount: otherAmount });

		const count = yield* countPayments({ amount: payment.amount, note: null });

		expect(count).toBe(matching);
	},
);

codecs.it("count combines an in-list of amounts with equality on the note", [], function* ({ countPayments, insertPayment }) {
	const listed = [payment.amount, otherAmount];
	for (const amount of listed) {
		yield* insertPayment({ amount });
	}
	yield* insertPayment({ amount: otherAmount, note: "paid" });
	yield* insertPayment({ amount: BigDecimal.fromStringUnsafe("99.5") });

	const count = yield* countPayments({ amount: { in: listed }, note: null });

	expect(count).toBe(listed.length);
});

codecs.it("count of an empty table is zero", [], function* ({ countPayments }) {
	const count = yield* countPayments();

	expect(count).toBe(0);
});

codecs.it(
	"count without a filter or with an empty query counts every payment",
	[],
	function* ({ countPayments, countPaymentsWithEmptyQuery, insertPayment, insertPayments }) {
		yield* insertPayments(2);
		yield* insertPayment({ note: "paid" });

		const counts = [yield* countPayments(), yield* countPaymentsWithEmptyQuery()];

		expect(counts).toEqual([3, 3]);
	},
);
