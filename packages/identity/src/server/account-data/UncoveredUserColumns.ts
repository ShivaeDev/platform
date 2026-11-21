import { Schema } from "effect";

const TableColumn = Schema.Struct({ column: Schema.String, schema: Schema.String, table: Schema.String });

export type TableColumn = typeof TableColumn.Type;

export class UncoveredUserColumns extends Schema.TaggedError<UncoveredUserColumns>()("UncoveredUserColumns", {
	columns: Schema.Array(TableColumn),
}) {
	override get message() {
		const columns = this.columns.map(({ column, schema, table }) => `${schema}.${table}.${column}`).join(", ");
		return `Columns refer to a person, but no owned model covers them: ${columns}. Mark the column's field with owner from @shivaedev/sql/owner.ts on a model that has a repository, or declare its foreign key ON DELETE SET NULL when the row stays without the person`;
	}
}
