import { expect } from "vitest";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { postgres, singleConnection } from "#test/prismaTraits.ts";

prisma.it.runIf(postgresEnabled)(
	"writtenTables leaves out what earlier transactions wrote on a reused connection",
	[singleConnection(), postgres()],
	function* ({ database: { reusedConnection } }) {
		const { earlier, later, cumulative, written } = yield* reusedConnection(false);
		expect(later).toBe(earlier);
		expect(cumulative).toEqual(["changes_prisma_membership", "changes_prisma_order"]);
		expect(written).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"writtenTables still reports a table the transaction wrote after its baseline, even one an earlier transaction wrote",
	[singleConnection(), postgres()],
	function* ({ database: { reusedConnection } }) {
		const { earlier, later, written } = yield* reusedConnection(true);
		expect(later).toBe(earlier);
		expect(written).toEqual(["changes_prisma_order"]);
	},
);
