import { BigDecimal } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { BEYOND_NUMBER, PRECISE_AMOUNT, payment } from "#test/codecModels.ts";
import { codecs, inTimezone, paymentExists } from "#test/codecs.ts";

codecs.it(
	"an inserted payment reads back its precise numeric, int8, date and timestamps, with a database-generated creation time",
	[],
	function* ({ insertPayment, payment: storedPayment }) {
		yield* insertPayment();

		expect(yield* storedPayment()).toEqual({
			amount: PRECISE_AMOUNT,
			createdAt: "a database-generated date",
			dueOn: "2026-09-30",
			localTime: "2026-09-19T10:11:12.345Z",
			note: null,
			sequence: BEYOND_NUMBER,
			settledAt: "2026-09-19T10:11:12.345Z",
		});
	},
);

codecs.it(
	"an equality filter on the precise amount and a null note matches the payment and decodes only the selected fields",
	[paymentExists()],
	function* ({ insertPayment, paymentsMatching }) {
		yield* insertPayment({ amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789013") });

		const found = yield* paymentsMatching({ amount: payment.amount, note: null });

		expect(found).toEqual([{ amount: PRECISE_AMOUNT, sequence: BEYOND_NUMBER }]);
	},
);

codecs.it(
	"an update stores the new date, note and int8 value exactly",
	[paymentExists()],
	function* ({ payment: storedPayment, storedPayment: storedText, updatePayment }) {
		yield* updatePayment({ "due_on": "2026-10-31", note: "verified", sequence: 9_007_199_254_740_995n });

		yield* outcomes({
			"payment as read back": [storedPayment(), expect.objectContaining({ dueOn: "2026-10-31", note: "verified", sequence: 9_007_199_254_740_995n })],
			"stored text": [storedText(), expect.objectContaining({ amount: PRECISE_AMOUNT, dueOn: "2026-10-31", sequence: "9007199254740995" })],
		});
	},
);

codecs.it(
	"a stored NaN amount fails the read with a schema error and the enclosing transaction rolls back its write",
	[paymentExists()],
	function* ({ decodeNanAmountInTransaction, endings, payment: storedPayment }) {
		yield* decodeNanAmountInTransaction();

		yield* outcomes({
			"payment as read back": [storedPayment(), expect.objectContaining({ amount: PRECISE_AMOUNT, note: null })],
			"transaction endings": [endings(), ["failed with a schema error"]],
		});
	},
);

codecs.it(
	"a timestamp without time zone is written as UTC wall time while the process runs in New York",
	[inTimezone("America/New_York")],
	function* ({ insertPayment, storedPayment: storedText }) {
		yield* insertPayment();

		expect((yield* storedText())?.localTime).toBe("2026-09-19 10:11:12.345");
	},
);

codecs.it(
	"timestamps read back as UTC instants at millisecond precision while PostgreSQL keeps the microseconds",
	[inTimezone("America/New_York"), paymentExists()],
	function* ({ payment: storedPayment, preciseStoredSettledAt, rewriteTimesWithMicroseconds }) {
		yield* rewriteTimesWithMicroseconds();

		yield* outcomes({
			"payment as read back": [
				storedPayment(),
				expect.objectContaining({ localTime: "2026-09-19T10:11:12.345Z", settledAt: "2026-09-19T10:11:12.345Z" }),
			],
			"stored settled_at in UTC": [preciseStoredSettledAt(), ["2026-09-19 10:11:12.345678"]],
		});
	},
);

codecs.it(
	"a plain object written to a JSON column fails with a SQL error and writes no receipt",
	[],
	function* ({ endings, insertReceipt, receiptCount }) {
		yield* insertReceipt({ attempts: 1, channel: "card" });

		yield* outcomes({
			"receipt endings": [endings(), ["failed with an unclassified SQL failure"]],
			"stored receipts": [receiptCount(), 0],
		});
	},
);
