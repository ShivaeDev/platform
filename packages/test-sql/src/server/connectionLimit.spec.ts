import { expect } from "vitest";
import { database } from "#test/database.ts";
import { exhaustedRole, roleLimit, sharedConnectionIdle } from "#test/databaseTraits.ts";

const CONNECTION_LIMIT_FAILURE =
	"failed with SQLSTATE 53300: PostgreSQL connection limit reached (SQLSTATE 53300): check max_connections and role connection limits. Try vitest run --maxWorkers=4, reduce the suite's maxConnections, or increase the server's connection budget.";

for (const wrapper of ["a rollback test", "an isolated block"] as const) {
	database.it(`a query in ${wrapper} that divides by zero fails with PostgreSQL's own division-by-zero error`, [], function* ({ divideByZeroIn }) {
		expect(yield* divideByZeroIn(wrapper)).toBe("failed with SQLSTATE 22012: division by zero");
	});
}

database.it(
	"with a role allowed two connections, a clone opens beside an idle shared connection, because no administration connection stays open",
	[roleLimit(2), sharedConnectionIdle],
	function* ({ items }) {
		expect(yield* items("a new clone")).toEqual(["seed"]);
	},
);

database.it(
	"when another client holds the role's only connection, starting the worker fails with the connection-limit hint",
	[roleLimit(), exhaustedRole],
	function* ({ workerStart }) {
		expect(yield* workerStart()).toBe(CONNECTION_LIMIT_FAILURE);
	},
);

database.it(
	"when the shared pool holds the role's only connection, a rollback test fails with the connection-limit hint",
	[roleLimit()],
	function* ({ rollbackTestWithoutConnections }) {
		expect(yield* rollbackTestWithoutConnections()).toBe(CONNECTION_LIMIT_FAILURE);
	},
);

database.it(
	"when an idle shared connection and an isolated block hold the role's two connections, another client the block opens fails with the connection-limit hint",
	[roleLimit(2), sharedConnectionIdle],
	function* ({ isolatedBlockWithoutConnections }) {
		expect(yield* isolatedBlockWithoutConnections()).toBe(CONNECTION_LIMIT_FAILURE);
	},
);
