import { BigDecimal, DateTime, Effect } from "effect";
import { expect } from "vitest";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { input, type Payment, UtcPayment } from "#test/postgresCodecs.ts";
import { hasArraySamples, hasInsertSelectRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";

postgres.it("numeric ranges distinguish inclusive and exclusive boundaries", [hasArraySamples()], function* ({ arraySamples }) {
	const { samples } = arraySamples();
	yield* samples.insertMany([1, 2, 3, 4].map((id) => ({ id, values: [id] })));
	const query = { orderBy: { direction: "asc", field: "id" }, select: ["id"] } as const;
	expect(yield* samples.findMany({ ...query, where: { id: { gt: 1, lt: 4 } } })).toEqual([{ id: 2 }, { id: 3 }]);
	expect(yield* samples.findMany({ ...query, where: { id: { gte: 1, lte: 4 } } })).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
	expect(yield* samples.findMany({ ...query, where: { id: { gt: 2, lte: 3 } } })).toEqual([{ id: 3 }]);
	expect(yield* samples.findMany({ ...query, where: { id: { gte: 2, lt: 3 } } })).toEqual([{ id: 2 }]);
	const invalid: Parameters<typeof samples.findMany>[0] = JSON.parse('{"where":{"values":{"gt":[1]}}}');
	expect((yield* samples.findMany(invalid).pipe(Effect.flip))._tag).toBe("SchemaError");
});

postgres.it("UTC timestamp bounds encode instants before PostgreSQL compares them", [hasPayments()], function* ({ paymentFixture, makeRepository }) {
	const { payments, tableName } = paymentFixture();
	const dates = ["2026-10-25T00:00:00.000Z", "2026-10-25T12:00:00.000Z", "2026-10-26T00:00:00.000Z"].map((value) => new Date(value));
	for (const settledAt of dates) {
		yield* payments.insert({ ...input, "settled_at": settledAt });
	}
	expect(
		yield* payments.findMany({
			orderBy: { direction: "asc", field: "settled_at" },
			select: ["settled_at"],
			where: { "settled_at": { gte: new Date("2026-10-24T14:00:00-10:00"), lt: new Date("2026-10-26T00:00:00Z") } },
		}),
	).toEqual(dates.slice(0, 2).map((settledAt) => ({ "settled_at": settledAt })));
	const utc = yield* makeRepository(UtcPayment, { idColumn: "id", spanPrefix: "UtcPayments", tableName });
	expect(
		(yield* utc.findMany({ select: ["settled_at"], where: { "settled_at": { gt: DateTime.makeUnsafe("2026-10-25T12:00:00Z") } } })).map(
			({ "settled_at": settledAt }) => DateTime.formatIso(settledAt),
		),
	).toEqual(["2026-10-26T00:00:00.000Z"]);
});

postgres.it("bigint and precise decimal bounds use their decoded field types", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const amount = BigDecimal.fromStringUnsafe;
	const first = yield* payments.insert({ ...input, amount: amount("9007199254740993.1"), sequence: 9007199254740993n });
	const second = yield* payments.insert({ ...input, amount: amount("9007199254740993.2"), sequence: 9007199254740994n });
	yield* payments.insert({ ...input, amount: amount("9007199254740993.3"), sequence: 9007199254740995n });
	expect(
		yield* payments.findMany({
			orderBy: { direction: "asc", field: "sequence" },
			select: ["id"],
			where: { amount: { gte: first.amount, lt: amount("9007199254740993.3") }, sequence: { gt: 9007199254740992n, lte: second.sequence } },
		}),
	).toEqual([{ id: first.id }, { id: second.id }]);
});

postgres.it("text patterns compose with ranges, lists and equality without interpolating SQL", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	for (const note of ["Run_a", "Run_ab", "run_a", "Other", "Run_' OR true --"]) {
		yield* payments.insert({ ...input, note });
	}
	const query = { orderBy: { direction: "asc", field: "id" }, select: ["note"] } as const;
	expect(
		yield* payments.findMany({
			...query,
			where: { "due_on": input.due_on, note: { gte: "Run", like: "Run__", lt: "S" }, sequence: { in: [input.sequence] } },
		}),
	).toEqual([{ note: "Run_a" }]);
	expect(yield* payments.findMany({ ...query, where: { note: { like: "Run_%" } } })).toEqual([
		{ note: "Run_a" },
		{ note: "Run_ab" },
		{ note: "Run_' OR true --" },
	]);
	expect(yield* payments.findMany({ ...query, where: { note: { like: "Run_' OR true --" } } })).toEqual([{ note: "Run_' OR true --" }]);
});

postgres.it("select applies ranges and patterns through field codecs in insert-from-select", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source, target } = insertSelect();
	const rows = yield* target.insertFromSelect(
		source.select({
			select: ["sourceKey", "displayName", "amount"],
			where: { amount: { gte: 20, lt: 40 }, displayName: { like: "sec%" } },
		}),
		{ amount: "amount", copiedKey: "sourceKey", name: "displayName" },
	);
	expect(rows.map(({ amount, copiedKey, name }) => ({ amount, copiedKey, name }))).toEqual([{ amount: 20, copiedKey: 2, name: "second" }]);
});

postgres.it("range and pattern operands fail with SchemaError when they do not match the field", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const row = yield* payments.insert(input);
	expect(yield* payments.findMany({ select: ["id"], where: { sequence: { gt: input.sequence - 1n } } })).toEqual([{ id: row.id }]);
	const invalid = [
		'{"sequence":{"gt":"9007199254740993"}}',
		'{"settled_at":{"gte":"2026-10-25T00:00:00Z"}}',
		'{"note":{"like":42}}',
		'{"sequence":{"like":"9%"}}',
		'{"note":{"lt":null}}',
		'{"missing":{"gt":1}}',
	];
	for (const json of invalid) {
		const where: FindManyFilter<typeof Payment> = JSON.parse(json);
		expect((yield* payments.findMany({ where }).pipe(Effect.flip))._tag).toBe("SchemaError");
		expect((yield* payments.select({ where }).statement.pipe(Effect.flip))._tag).toBe("SchemaError");
	}
});
