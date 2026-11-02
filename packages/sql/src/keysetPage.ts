import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

export interface KeysetOrder<TCursor> {
	readonly column: string | Fragment;
	readonly direction: "asc" | "desc";
	readonly value: (cursor: TCursor) => string | number | bigint | boolean;
}

export interface KeysetPageQuery {
	readonly limit: number;
	readonly orderBy: Fragment;
	readonly seek: Fragment;
}

export interface KeysetPage<TRow, TCursor> {
	readonly next: Option.Option<TCursor>;
	readonly rows: readonly TRow[];
}

const PageSize = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThan(Number.MAX_SAFE_INTEGER));

export const keysetPage = Effect.fnUntraced(function* <TRow, TCursor, E, R>(options: {
	readonly limit: number;
	readonly after?: TCursor | undefined;
	readonly orderBy: readonly KeysetOrder<TCursor>[];
	readonly tieBreaker: KeysetOrder<TCursor>;
	readonly cursorFor: (row: TRow) => TCursor;
	readonly read: (query: KeysetPageQuery) => Effect.Effect<readonly TRow[], E, R>;
}): Effect.fn.Return<KeysetPage<TRow, TCursor>, E | Schema.SchemaError, R | SqlClient.SqlClient> {
	const limit = yield* Schema.decodeUnknownEffect(PageSize)(options.limit);
	const sql = yield* SqlClient.SqlClient;
	const order = [...options.orderBy, options.tieBreaker];
	const columns = order.map(({ column }) => (typeof column === "string" ? sql`${sql(column)}` : column));
	const after = options.after;
	const values = after === undefined ? undefined : order.map(({ value }) => value(after));
	const seek =
		values === undefined
			? sql`true`
			: sql.or(
					order.map(({ direction }, index) =>
						sql.and([
							...columns.slice(0, index).map((column, previous) => sql`${column} = ${values[previous]}`),
							direction === "asc" ? sql`${columns[index]} > ${values[index]}` : sql`${columns[index]} < ${values[index]}`,
						]),
					),
				);
	const orderBy = sql.csv(order.map(({ direction }, index) => sql`${columns[index]} ${sql.literal(direction === "asc" ? "asc" : "desc")}`));
	const found = yield* options.read({ limit: limit + 1, orderBy, seek });
	const rows = found.slice(0, limit);
	const last = rows.at(-1);
	return { next: found.length > limit && last !== undefined ? Option.some(options.cursorFor(last)) : Option.none(), rows };
});
