import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { eraseOrder } from "#server/account-data/eraseOrder.ts";
import { foreignKeys } from "#server/account-data/foreignKeys.ts";
import { OwnedTableCycle } from "#server/account-data/OwnedTableCycle.ts";
import { ownedTables } from "#server/account-data/ownedTables.ts";

// A cascading or nulling key orders nothing: PostgreSQL resolves it whichever row goes first.
const ORDERING_ACTIONS = new Set(["a", "r"]);

// Runs on the caller's connection, so a surrounding transact erases everything or nothing.
export const eraseOwnedRows = Effect.fn("Identity.eraseOwnedRows")(function* (userId: string) {
	const owned = yield* ownedTables();
	const relations = [...new Set(owned.map(({ relation }) => relation))].sort((left, right) => left.localeCompare(right));
	const references = (yield* foreignKeys())
		.filter(({ onDelete }) => ORDERING_ACTIONS.has(onDelete))
		.map(({ schema, table, target }) => ({ source: `${schema}.${table}`, target: `${target.schema}.${target.table}` }));
	const order = eraseOrder(relations, references);
	if (Result.isFailure(order)) {
		return yield* new OwnedTableCycle({ tables: order.failure });
	}
	const sql = yield* SqlClient.SqlClient;
	for (const relation of order.success) {
		for (const { owner, table } of owned.filter((model) => model.relation === relation)) {
			yield* sql`delete from ${sql(table)} where ${sql(owner.field)} = ${userId}`;
		}
	}
});
