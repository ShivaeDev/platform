import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { makeChanges } from "./support/changes.ts";
import { integration, makeDatabase, orderIds } from "./support/database.ts";

integration("one write records a change for every subject its mapping names", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				yield* changes.use((db) => db.membership.create({ data: { id: "m1", ownerId: "ada", memberId: "bob" } })).pipe(changes.transaction);
				yield* changes.use((db) => db.membership.delete({ where: { id: "m1" } }));
				expect(published).toEqual([
					["ada:memberships", "bob:memberships"],
					["ada:memberships", "bob:memberships"],
				]);
			}),
		),
	),
);

const orders = [
	{ id: "o1", ownerId: "ada", total: 1 },
	{ id: "o2", ownerId: "bob", total: 2 },
];

integration("row-returning writes record per row; reads and models mapped to null record nothing", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client } = yield* makeDatabase;
				const { changes, published, unnamed, observe } = makeChanges(client);
				yield* Effect.gen(function* () {
					yield* changes.use((db) => db.order.createManyAndReturn({ data: orders }));
					yield* changes.use((db) => db.order.update({ where: { id: "o1" }, data: { total: 3 } }));
					yield* changes.use((db) => db.order.upsert({ where: { id: "o3" }, create: { id: "o3", ownerId: "cyd", total: 1 }, update: {} }));
					yield* changes.use((db) => db.order.findMany());
					yield* changes.use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
				}).pipe(changes.transaction, observe);
				expect(published).toEqual([["ada:orders", "bob:orders", "cyd:orders"]]);
				expect(unnamed).toEqual([]);
			}),
		),
	),
);

integration("count-only *Many writes and narrowed results record nothing and are reported as unnamed", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client } = yield* makeDatabase;
				const { changes, published, unnamed, observe } = makeChanges(client);
				yield* Effect.gen(function* () {
					yield* changes.use((db) => db.order.createMany({ data: [{ id: "o1", ownerId: "ada", total: 1 }] }));
					yield* changes.use((db) => db.order.updateMany({ where: { ownerId: "ada" }, data: { total: 2 } }));
					yield* changes.use((db) => db.order.update({ where: { id: "o1" }, data: { total: 3 }, select: { id: true } }));
					yield* changes.use((db) => db.auditNote.deleteMany({}));
					yield* changes.use((db) => db.order.deleteMany({ where: { ownerId: "nobody" } }));
				}).pipe(changes.transaction, observe);
				expect(published).toEqual([]);
				expect(unnamed).toEqual([
					{ model: "Order", operation: "createMany", reason: "countOnly" },
					{ model: "Order", operation: "updateMany", reason: "countOnly" },
					{ model: "Order", operation: "update", reason: "narrowed", field: "ownerId" },
					{ model: "Order", operation: "deleteMany", reason: "countOnly" },
				]);
			}),
		),
	),
);

integration("a write outside any transaction publishes as soon as it autocommits", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				yield* changes.use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));
				expect(published).toEqual([["ada:invoices"]]);
				yield* changes.channel.batch(
					Effect.gen(function* () {
						yield* changes.use((db) => db.invoice.update({ where: { id: "i1" }, data: { ownerId: "bob" } }));
						yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "bob", total: 1 } }));
						expect(published).toHaveLength(1);
					}),
				);
				expect(published).toEqual([["ada:invoices"], ["bob:invoices", "bob:orders"]]);
			}),
		),
	),
);

const slowInsert = (schema: string) => [
	`create function "${schema}".slow_insert() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$`,
	`create trigger slow_insert before insert on "${schema}".changes_prisma_order for each row execute function "${schema}".slow_insert()`,
];

integration("an interrupted use still records a write that ran", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, client, observer, execute } = yield* makeDatabase;
				yield* execute(...slowInsert(schema));
				const { changes, published } = makeChanges(client);
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
				expect(yield* orderIds(observer)).toEqual(["o1"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);
