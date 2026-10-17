import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError } from "#error.ts";
import { prisma } from "#test/prisma.ts";
import { insertsTakeTheirTime, mappingRejectsNegativeTotals } from "#test/prismaTraits.ts";

prisma.it(
	"a missing-row update fails with P2025 without expiring a transaction that can still commit",
	[],
	function* ({ published, use, transaction, orderIds }) {
		const failure = yield* transaction(
			Effect.gen(function* () {
				const rejected = yield* Effect.flip(use((db) => db.order.update({ data: { total: 2 }, where: { id: "missing" } })));
				yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
				return rejected;
			}),
		);
		expect(failure).toBeInstanceOf(PrismaError);
		expect(failure.cause).toMatchObject({ code: "P2025" });
		expect(yield* orderIds()).toEqual(["o1"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);

const mappingError = new Error("Negative order totals cannot name a change");

prisma.it(
	"a consumer mapping error remains the exact defect after the write autocommits and publishes nothing",
	[mappingRejectsNegativeTotals(mappingError)],
	function* ({ order, orderIds, published }) {
		const exit = yield* Effect.exit(order("o1", "ada", -1));
		expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(mappingError);
		expect(yield* orderIds()).toEqual(["o1"]);
		expect(published()).toEqual([]);
	},
);

prisma.it("one write records a change for every subject its mapping names", [], function* ({ published, use, transaction }) {
	yield* use((db) => db.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } })).pipe(transaction);
	yield* use((db) => db.membership.delete({ where: { id: "m1" } }));
	expect(published()).toEqual([
		["ada:memberships", "bob:memberships"],
		["ada:memberships", "bob:memberships"],
	]);
});

const orders = [
	{ id: "o1", ownerId: "ada", total: 1 },
	{ id: "o2", ownerId: "bob", total: 2 },
];

prisma.it(
	"row-returning writes record per row; reads and models mapped to null record nothing",
	[],
	function* ({ published, unnamed, observe, use, transaction }) {
		yield* Effect.gen(function* () {
			yield* use((db) => db.order.createManyAndReturn({ data: orders }));
			yield* use((db) => db.order.update({ data: { total: 3 }, where: { id: "o1" } }));
			yield* use((db) => db.order.upsert({ create: { id: "o3", ownerId: "cyd", total: 1 }, update: {}, where: { id: "o3" } }));
			yield* use((db) => db.order.findMany());
			yield* use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
		}).pipe(transaction, observe);
		expect(published()).toEqual([["ada:orders", "bob:orders", "cyd:orders"]]);
		expect(unnamed).toEqual([]);
	},
);

prisma.it(
	"count-only *Many writes and narrowed results record nothing and are reported as unnamed",
	[],
	function* ({ published, unnamed, observe, use, transaction }) {
		yield* Effect.gen(function* () {
			yield* use((db) => db.order.createMany({ data: [{ id: "o1", ownerId: "ada", total: 1 }] }));
			yield* use((db) => db.order.updateMany({ data: { total: 2 }, where: { ownerId: "ada" } }));
			yield* use((db) => db.order.update({ data: { total: 3 }, select: { id: true }, where: { id: "o1" } }));
			yield* use((db) => db.auditNote.deleteMany({}));
			yield* use((db) => db.order.deleteMany({ where: { ownerId: "nobody" } }));
		}).pipe(transaction, observe);
		expect(published()).toEqual([]);
		expect(unnamed).toEqual([
			{ model: "Order", operation: "createMany", reason: "countOnly" },
			{ model: "Order", operation: "updateMany", reason: "countOnly" },
			{ field: "ownerId", model: "Order", operation: "update", reason: "narrowed" },
			{ model: "Order", operation: "deleteMany", reason: "countOnly" },
		]);
	},
);

prisma.it("a write outside any transaction publishes as soon as it autocommits", [], function* ({ changes, published, use }) {
	yield* use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));
	expect(published()).toEqual([["ada:invoices"]]);
	yield* changes.channel.batch(
		Effect.gen(function* () {
			yield* use((db) => db.invoice.update({ data: { ownerId: "bob" }, where: { id: "i1" } }));
			yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "bob", total: 1 } }));
			expect(published()).toHaveLength(1);
		}),
	);
	expect(published()).toEqual([["ada:invoices"], ["bob:invoices", "bob:orders"]]);
});

prisma.it("an interrupted use still records a write that ran", [insertsTakeTheirTime()], function* ({ changes, published, orderIds }) {
	const started = yield* Deferred.make<void>();
	const fiber = yield* changes
		.use((db) => {
			Effect.runSync(Deferred.succeed(started, undefined));
			return db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } });
		})
		.pipe(Effect.forkChild);
	yield* Deferred.await(started);
	yield* Fiber.interrupt(fiber);
	const exit = yield* Fiber.await(fiber);
	expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
	expect(yield* orderIds()).toEqual(["o1"]);
	expect(published()).toEqual([["ada:orders"]]);
});
