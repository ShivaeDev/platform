import { readFile } from "node:fs/promises";
import { Data, Effect } from "effect";
import { expect } from "vitest";
import { checkCoverage, tablesOf, tableWrites, writtenTables } from "../src/index.ts";
import { type Change, makeChanges, models } from "./support/changes.ts";
import { integration, makeDatabase } from "./support/database.ts";

class Rejected extends Data.TaggedError("Rejected") {}

const domains: Readonly<Record<string, string>> = { Order: "orders", Membership: "memberships", Invoice: "invoices" };
const covers = (model: string, change: Change) => domains[model] === change.domain;

class RolledBack {
	readonly written: ReadonlyArray<string>;

	constructor(written: ReadonlyArray<string>) {
		this.written = written;
	}
}

integration("the coverage check reads the tables a test transaction wrote and reports the writes no change covers", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, client, execute } = yield* makeDatabase;
				yield* execute(`create table "${schema}".changes_prisma_lookup (id text primary key)`);
				const { changes, observations, unnamed, observe } = makeChanges(client);
				const tables = tablesOf(yield* Effect.promise(() => readFile(new URL("./prisma/schema.prisma", import.meta.url), "utf8")));
				const application = Effect.gen(function* () {
					yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
					yield* Effect.ignore(
						Effect.andThen(
							changes.use((db) => db.membership.create({ data: { id: "m1", ownerId: "ada", memberId: "bob" } })),
							Effect.fail(new Rejected()),
						).pipe(changes.transaction),
					);
					yield* changes.use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
					yield* changes.use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_invoice (id, owner_id) values ('i1', 'ada')`));
					yield* changes.use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_unmodeled (id) values ('u1')`));
					yield* changes.use((db) => db.$queryRawUnsafe(`select id from "${schema}".changes_prisma_lookup`));
					yield* changes.use((db) => db.order.updateMany({ where: { ownerId: "ada" }, data: { total: 2 } }));
				});
				const context = yield* Effect.context<never>();
				const written = yield* Effect.promise(() =>
					client
						.$transaction(async (tx) => {
							const since = await Effect.runPromise(tableWrites(tx));
							await Effect.runPromiseWith(context)(application.pipe(Effect.provideService(changes.Client, tx), observe));
							throw new RolledBack(await Effect.runPromise(writtenTables(tx, since)));
						})
						.catch((error: unknown) => (error instanceof RolledBack ? error.written : [])),
				);
				expect(written).toEqual([
					"AuditNote",
					"changes_prisma_invoice",
					"changes_prisma_membership",
					"changes_prisma_order",
					"changes_prisma_unmodeled",
				]);
				expect(yield* Effect.promise(() => client.order.count())).toBe(0);
				expect(checkCoverage({ written, tables, models, observations, unnamed, covers })).toEqual([
					{ _tag: "Unrecorded", table: "changes_prisma_invoice", model: "Invoice" },
					{ _tag: "Unrecorded", table: "changes_prisma_unmodeled", model: undefined },
					{ _tag: "Unnamed", write: { model: "Order", operation: "updateMany", reason: "countOnly" } },
				]);
			}),
		),
	),
);
