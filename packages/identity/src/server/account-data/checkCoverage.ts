import { Effect } from "effect";
import { foreignKeys } from "#server/account-data/foreignKeys.ts";
import { ownedTables } from "#server/account-data/ownedTables.ts";
import { type TableColumn, UncoveredUserColumns } from "#server/account-data/UncoveredUserColumns.ts";

const SET_NULL = "n";

function key({ column, schema, table }: TableColumn) {
	return `${schema}.${table}.${column}`;
}

// Identity's own tables are covered because the person's auth user row goes with the account and they reference it.
export const checkCoverage = Effect.fn("Identity.checkCoverage")(function* (reference: TableColumn, authTables: ReadonlySet<string>) {
	const owners = new Set((yield* ownedTables()).map(({ ownerKey }) => ownerKey));
	const user = key(reference);
	const uncovered = new Map<string, TableColumn>();
	for (const foreignKey of yield* foreignKeys()) {
		const refersToPerson = key(foreignKey.target) === user || owners.has(key(foreignKey.target));
		const covered =
			owners.has(key(foreignKey)) || foreignKey.onDelete === SET_NULL || (foreignKey.schema === reference.schema && authTables.has(foreignKey.table));
		if (refersToPerson && !covered) {
			uncovered.set(key(foreignKey), { column: foreignKey.column, schema: foreignKey.schema, table: foreignKey.table });
		}
	}
	if (uncovered.size > 0) {
		return yield* new UncoveredUserColumns({ columns: [...uncovered.values()] });
	}
});
