import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

const Limit = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const decodeLimit = Schema.decodeUnknownEffect(Limit);
interface Order {
	readonly direction: "asc" | "desc";
	readonly field: string;
}

export const makeQueryClauses = Effect.fnUntraced(function* (
	fieldAt: (key: string) => Effect.Effect<unknown, Schema.SchemaError>,
	column?: (key: string) => Fragment,
) {
	const sql = yield* SqlClient.SqlClient;
	function orderClause(orderBy: Order | readonly Order[] | undefined) {
		if (orderBy === undefined) {
			return Effect.succeed(sql``);
		}
		const entries = "field" in orderBy ? [orderBy] : orderBy;
		if (entries.length === 0) {
			return Effect.succeed(sql``);
		}
		return Effect.map(
			Effect.forEach(entries, ({ field, direction }) =>
				Effect.as(fieldAt(field), sql`${column?.(field) ?? sql`${sql(field)}`} ${sql.literal(direction === "desc" ? "desc" : "asc")}`),
			),
			(columns) => sql`order by ${sql.csv(columns)}`,
		);
	}
	function limitClause(limit: number | undefined) {
		return limit === undefined ? Effect.succeed(sql``) : Effect.map(decodeLimit(limit), (rowLimit) => sql`limit ${rowLimit}`);
	}
	return { decodeLimit, limitClause, orderClause };
});
