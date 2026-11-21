import { Context, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { OwnedModelsUncollected } from "#server/account-data/OwnedModelsUncollected.ts";

const ResolvedTable = Schema.Struct({ name: Schema.String, schema: Schema.String, table: Schema.String });

// Quoted the way a repository's statement names its table, so the catalog resolves the same relation through the search path.
function quotedName(name: string) {
	return name
		.split(".")
		.map((part) => `"${part.replaceAll('"', '""')}"`)
		.join(".");
}

export const ownedTables = Effect.fn("Identity.ownedTables")(function* () {
	const models = yield* RepositoryModels;
	// Without a collector the Reference holds its default, which records nothing, so an empty list would read as "nothing owned".
	if (Option.getOrUndefined(Context.getOption(Context.empty(), RepositoryModels)) === models) {
		return yield* new OwnedModelsUncollected();
	}
	const owned = yield* models.owned;
	const names = [...new Set(owned.map(({ table }) => table))];
	if (names.length === 0) {
		return [];
	}
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const resolved = yield* SqlSchema.findAll({
		execute: () => sql`
		select owned.name, namespace.nspname as schema, relation.relname as table
		from (values ${sql.csv(names.map((name) => sql`(${name}, ${quotedName(name)})`))}) as owned(name, quoted)
		join pg_catalog.pg_class relation on relation.oid = to_regclass(owned.quoted)
		join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace`,
		Request: Schema.Void,
		Result: ResolvedTable,
	})(undefined);
	return owned.flatMap((model) => {
		const table = resolved.find(({ name }) => name === model.table);
		return table === undefined
			? []
			: [{ ...model, ownerKey: `${table.schema}.${table.table}.${model.owner.column}`, relation: `${table.schema}.${table.table}` }];
	});
});
