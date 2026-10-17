import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { clientIsConfigured } from "#test/prismaTraits.ts";

prisma.it(
	"writtenTables leaves out what earlier transactions wrote on a reused connection",
	[clientIsConfigured({ max: 1 })],
	function* ({ reusedConnection }) {
		const { earlier, later, cumulative, written } = yield* reusedConnection(() => Promise.resolve());
		expect(later).toBe(earlier);
		expect(cumulative).toEqual(["changes_prisma_membership", "changes_prisma_order"]);
		expect(written).toEqual([]);
	},
);

prisma.it(
	"writtenTables still reports a table the transaction wrote after its baseline, even one an earlier transaction wrote",
	[clientIsConfigured({ max: 1 })],
	function* ({ reusedConnection }) {
		const { earlier, later, written } = yield* reusedConnection((tx) => tx.order.create({ data: { id: "o2", ownerId: "bob", total: 2 } }));
		expect(later).toBe(earlier);
		expect(written).toEqual(["changes_prisma_order"]);
	},
);
