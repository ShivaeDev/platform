import { Effect, Schema, SchemaAST } from "effect";
import { SqlClient } from "effect/sql";
import { groupColumns } from "@shivaedev/sql/adapters/groupColumns.ts";
import type { OwnedModel } from "@shivaedev/sql/RepositoryModels.ts";
import { sqlNameTransforms } from "@shivaedev/sql/sqlNameTransforms.ts";
import { storageSchema } from "@shivaedev/sql/storageSchema.ts";
import { ownedTables } from "#server/account-data/ownedTables.ts";

// The host reports models with their types erased; the JSON variant's fields are the ones a client may already
// receive, so reading and encoding them needs no service. A server-only or encrypted field has no JSON variant and
// is never read.
type Exported = Schema.ConstraintCodec<unknown, unknown, never, never>;

function exportedSchemas({ model }: OwnedModel, names: Effect.Success<typeof sqlNameTransforms>) {
	const json = model.json.ast;
	const properties: SchemaAST.PropertySignature[] = [];
	const fields: Record<string, Schema.Constraint> = {};
	for (const property of SchemaAST.isObjects(json) ? json.propertySignatures : []) {
		const field = typeof property.name === "string" ? model.fields[property.name] : undefined;
		if (typeof property.name === "string" && field !== undefined) {
			properties.push(property);
			fields[property.name] = field;
		}
	}
	return {
		columns: groupColumns(fields),
		json: Schema.make<Exported>(new SchemaAST.Objects(properties, [])),
		stored: Schema.make<Exported>(storageSchema(Schema.Struct(fields), fields, names).ast),
	};
}

export const exportOwnedRows = Effect.fn("Identity.exportOwnedRows")(function* (userId: string) {
	const sql = yield* SqlClient.SqlClient;
	const names = yield* sqlNameTransforms;
	const owned = [...(yield* ownedTables())].sort((left, right) => left.table.localeCompare(right.table));
	return yield* Effect.forEach(owned, (model) =>
		Effect.gen(function* () {
			const { columns, json, stored } = exportedSchemas(model, names);
			const selected = sql.csv(columns.map(({ column }) => sql`${sql(column)}`));
			const rows = yield* sql`select ${selected} from ${sql(model.table)} where ${sql(model.owner.field)} = ${userId}`;
			const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(stored))(rows);
			return { rows: yield* Schema.encodeUnknownEffect(Schema.Array(json))(decoded), table: model.table };
		}),
	);
});
