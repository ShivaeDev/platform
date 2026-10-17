import { Effect } from "effect";
import { expect } from "vitest";
import { checkCoverage } from "#coverage.ts";
import { prisma } from "#test/prisma.ts";
import { coverageIsChecked, ordersExist } from "#test/prismaTraits.ts";

prisma.it(
	"a written table is covered by a recorded change of its model, including changes that were later discarded",
	[coverageIsChecked()],
	function* ({ coverageOf, order, use, transaction }) {
		const { violations, input } = yield* coverageOf(
			Effect.gen(function* () {
				yield* order("o1");
				yield* Effect.ignore(
					Effect.andThen(
						use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } })),
						Effect.fail("discard invoice"),
					).pipe(transaction),
				);
				yield* use((db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
			}),
		);
		expect(input.observations.some((o) => o._tag === "Discarded" && o.changes.some((c) => c.domain === "invoices"))).toBe(true);
		expect(violations).toEqual([]);
	},
);

prisma.it(
	"a written table without a covering change, or without a model, is reported once; Published alone does not cover it",
	[coverageIsChecked()],
	function* ({ coverageOf, order, use, schema }) {
		const { input } = yield* coverageOf(
			Effect.gen(function* () {
				yield* order("o1");
				yield* use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));
				yield* use((db) => db.$executeRawUnsafe(`insert into "${schema}".changes_prisma_unmodeled (id) values ('u1')`));
			}),
		);
		expect(input.observations.some((o) => o._tag === "Published" && o.changes.some((c) => c.domain === "invoices"))).toBe(true);
		const observations = input.observations.filter((o) => o._tag !== "Recorded" || o.changes.every((c) => c.domain !== "invoices"));
		expect(checkCoverage({ ...input, observations, written: [...input.written, ...input.written] })).toEqual([
			{ _tag: "Unrecorded", model: "Invoice", table: "changes_prisma_invoice" },
			{ _tag: "Unrecorded", model: undefined, table: "changes_prisma_unmodeled" },
		]);
	},
);

prisma.it(
	"every distinct unnamed write is a violation even when its table is covered",
	[coverageIsChecked(), ordersExist({ id: "o1", ownerId: "ada", total: 1 })],
	function* ({ coverageOf, order, use }) {
		const { violations } = yield* coverageOf(
			Effect.gen(function* () {
				yield* order("o2");
				yield* use((db) => db.order.updateMany({ data: { total: 2 } }));
				yield* use((db) => db.order.update({ data: { total: 3 }, select: { id: true }, where: { id: "o1" } }));
				yield* use((db) => db.order.updateMany({ data: { total: 4 } }));
			}),
		);
		expect(violations).toEqual([
			{ _tag: "Unnamed", write: { model: "Order", operation: "updateMany", reason: "countOnly" } },
			{ _tag: "Unnamed", write: { field: "ownerId", model: "Order", operation: "update", reason: "narrowed" } },
		]);
	},
);
