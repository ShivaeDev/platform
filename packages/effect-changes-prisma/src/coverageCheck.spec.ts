import { Data, Effect } from "effect";
import { expect } from "vitest";
import { checkCoverage } from "#coverage.ts";
import { type Change, models } from "#test/changes.ts";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { hasLookupTable, postgres } from "#test/prismaTraits.ts";

class Rejected extends Data.TaggedError("Rejected") {}

const domains: Readonly<Record<string, string>> = { Invoice: "invoices", Membership: "memberships", Order: "orders" };
function covers(model: string, change: Change) {
	return domains[model] === change.domain;
}

prisma.it.runIf(postgresEnabled)(
	"the coverage check reads the tables a test transaction wrote and reports the writes no change covers",
	[postgres(), hasLookupTable()],
	function* ({ database: { client, schema, changes, unnamed, observations, writtenBy, tables } }) {
		const application = Effect.gen(function* () {
			yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
			yield* Effect.ignore(
				Effect.andThen(
					changes.use((db) => db.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } })),
					Effect.fail(new Rejected()),
				).pipe(changes.transaction),
			);
			yield* changes.use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
			yield* changes.use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_invoice (id, owner_id) values ('i1', 'ada')`));
			yield* changes.use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_unmodeled (id) values ('u1')`));
			yield* changes.use((db) => db.$queryRawUnsafe(`select id from "${schema}".changes_prisma_lookup`));
			yield* changes.use((db) => db.order.updateMany({ data: { total: 2 }, where: { ownerId: "ada" } }));
		});
		const written = yield* writtenBy(application);
		expect(written).toEqual(["AuditNote", "changes_prisma_invoice", "changes_prisma_membership", "changes_prisma_order", "changes_prisma_unmodeled"]);
		expect(yield* Effect.promise(() => client.order.count())).toBe(0);
		expect(checkCoverage({ covers, models, observations, tables, unnamed, written })).toEqual([
			{ _tag: "Unrecorded", model: "Invoice", table: "changes_prisma_invoice" },
			{ _tag: "Unrecorded", model: undefined, table: "changes_prisma_unmodeled" },
			{ _tag: "Unnamed", write: { model: "Order", operation: "updateMany", reason: "countOnly" } },
		]);
	},
);
