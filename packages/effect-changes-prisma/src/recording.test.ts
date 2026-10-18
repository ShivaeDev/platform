import { Cause, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError } from "#error.ts";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { postgres, rejectsNegativeTotals, slowWrites } from "#test/prismaTraits.ts";

const mappingError = new Error("Negative order totals cannot name a change");

prisma.it.runIf(postgresEnabled)(
	"a missing-row update fails with P2025 without expiring a transaction that can still commit",
	[postgres()],
	function* ({ database: { changes, published, orders } }) {
		const failure = yield* changes.transaction(
			Effect.gen(function* () {
				const rejected = yield* Effect.flip(changes.use((db) => db.order.update({ data: { total: 2 }, where: { id: "missing" } })));
				yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
				return rejected;
			}),
		);
		expect(failure).toBeInstanceOf(PrismaError);
		expect(failure.cause).toMatchObject({ code: "P2025" });
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a consumer mapping error remains the exact defect after the write autocommits and publishes nothing",
	[rejectsNegativeTotals(mappingError), postgres()],
	function* ({ database: { changes, published, orders } }) {
		const exit = yield* Effect.exit(changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: -1 } })));
		expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(mappingError);
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"one write records a change for every subject its mapping names",
	[postgres()],
	function* ({ database: { changes, published } }) {
		yield* changes.use((db) => db.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } })).pipe(changes.transaction);
		yield* changes.use((db) => db.membership.delete({ where: { id: "m1" } }));
		expect(published).toEqual([
			["ada:memberships", "bob:memberships"],
			["ada:memberships", "bob:memberships"],
		]);
	},
);

const returnedOrders = [
	{ id: "o1", ownerId: "ada", total: 1 },
	{ id: "o2", ownerId: "bob", total: 2 },
];

prisma.it.runIf(postgresEnabled)(
	"row-returning writes record per row; reads and models mapped to null record nothing",
	[postgres()],
	function* ({ database: { changes, published, unnamed, observe } }) {
		yield* Effect.gen(function* () {
			yield* changes.use((db) => db.order.createManyAndReturn({ data: returnedOrders }));
			yield* changes.use((db) => db.order.update({ data: { total: 3 }, where: { id: "o1" } }));
			yield* changes.use((db) => db.order.upsert({ create: { id: "o3", ownerId: "cyd", total: 1 }, update: {}, where: { id: "o3" } }));
			yield* changes.use((db) => db.order.findMany());
			yield* changes.use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
		}).pipe(changes.transaction, observe);
		expect(published).toEqual([["ada:orders", "bob:orders", "cyd:orders"]]);
		expect(unnamed).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"count-only *Many writes and narrowed results record nothing and are reported as unnamed",
	[postgres()],
	function* ({ database: { changes, published, unnamed, observe } }) {
		yield* Effect.gen(function* () {
			yield* changes.use((db) => db.order.createMany({ data: [{ id: "o1", ownerId: "ada", total: 1 }] }));
			yield* changes.use((db) => db.order.updateMany({ data: { total: 2 }, where: { ownerId: "ada" } }));
			yield* changes.use((db) => db.order.update({ data: { total: 3 }, select: { id: true }, where: { id: "o1" } }));
			yield* changes.use((db) => db.auditNote.deleteMany({}));
			yield* changes.use((db) => db.order.deleteMany({ where: { ownerId: "nobody" } }));
		}).pipe(changes.transaction, observe);
		expect(published).toEqual([]);
		expect(unnamed).toEqual([
			{ model: "Order", operation: "createMany", reason: "countOnly" },
			{ model: "Order", operation: "updateMany", reason: "countOnly" },
			{ field: "ownerId", model: "Order", operation: "update", reason: "narrowed" },
			{ model: "Order", operation: "deleteMany", reason: "countOnly" },
		]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a write outside any transaction publishes as soon as it autocommits",
	[postgres()],
	function* ({ database: { changes, published } }) {
		yield* changes.use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));
		expect(published).toEqual([["ada:invoices"]]);
		yield* changes.channel.batch(
			Effect.gen(function* () {
				yield* changes.use((db) => db.invoice.update({ data: { ownerId: "bob" }, where: { id: "i1" } }));
				yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "bob", total: 1 } }));
				expect(published).toHaveLength(1);
			}),
		);
		expect(published).toEqual([["ada:invoices"], ["bob:invoices", "bob:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"an interrupted use still records a write that ran",
	[postgres(), slowWrites()],
	function* ({ database: { published, orders, startOrderWrite } }) {
		const fiber = yield* startOrderWrite();
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);
