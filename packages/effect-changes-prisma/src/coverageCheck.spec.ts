import { Data, Effect } from "effect";
import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { coverageIsChecked, lookupTableExists } from "#test/prismaTraits.ts";

class Rejected extends Data.TaggedError("Rejected") {}

prisma.it(
	"the coverage check reads the tables a test transaction wrote and reports the writes no change covers",
	[coverageIsChecked(), lookupTableExists()],
	function* ({ schema, use, transaction, coverageOf, orderIds }) {
		const application = Effect.gen(function* () {
			yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
			yield* Effect.ignore(
				Effect.andThen(
					use((db) => db.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } })),
					Effect.fail(new Rejected()),
				).pipe(transaction),
			);
			yield* use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
			yield* use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_invoice (id, owner_id) values ('i1', 'ada')`));
			yield* use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_unmodeled (id) values ('u1')`));
			yield* use((db) => db.$queryRawUnsafe(`select id from "${schema}".changes_prisma_lookup`));
			yield* use((db) => db.order.updateMany({ data: { total: 2 }, where: { ownerId: "ada" } }));
		});
		const { written, violations } = yield* coverageOf(application);
		expect(written).toEqual(["AuditNote", "changes_prisma_invoice", "changes_prisma_membership", "changes_prisma_order", "changes_prisma_unmodeled"]);
		expect((yield* orderIds()).length).toBe(0);
		expect(violations).toEqual([
			{ _tag: "Unrecorded", model: "Invoice", table: "changes_prisma_invoice" },
			{ _tag: "Unrecorded", model: undefined, table: "changes_prisma_unmodeled" },
			{ _tag: "Unnamed", write: { model: "Order", operation: "updateMany", reason: "countOnly" } },
		]);
	},
);
