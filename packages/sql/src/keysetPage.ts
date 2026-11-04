import { Effect, Option, Schema } from "effect";
import * as Statement from "effect/sql/Statement";

export interface KeysetOrder<TCursor> {
	readonly column: string | Statement.Fragment;
	readonly direction: "asc" | "desc";
	readonly value: (cursor: TCursor) => string | number | bigint | boolean;
}

export interface KeysetPageQuery {
	readonly limit: number;
	readonly orderBy: Statement.Fragment;
	readonly seek: Statement.Fragment;
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
}): Effect.fn.Return<KeysetPage<TRow, TCursor>, E | Schema.SchemaError, R> {
	const limit = yield* Schema.decodeUnknownEffect(PageSize)(options.limit);
	const order = [...options.orderBy, options.tieBreaker].map((part) => ({
		...part,
		column: typeof part.column === "string" ? Statement.fragment([Statement.identifier(part.column)]) : part.column,
	}));
	const after = options.after;
	const values = after === undefined ? undefined : order.map(({ value }) => value(after));
	const conditions =
		values === undefined
			? []
			: order.map(({ column, direction }, index) => {
					const prefix = order
						.slice(0, index)
						.map(({ column: previousColumn }, previous) =>
							Statement.fragment([...previousColumn.segments, Statement.literal(" = "), Statement.parameter(values[previous])]),
						);
					const comparison = Statement.fragment([
						...column.segments,
						Statement.literal(direction === "asc" ? " > " : " < "),
						Statement.parameter(values[index]),
					]);
					return Statement.and([...prefix, comparison]);
				});
	const seek = values === undefined ? Statement.fragment([Statement.literal("true")]) : Statement.or(conditions);
	const orderBy = Statement.csv(
		order.map(({ column, direction }) => Statement.fragment([...column.segments, Statement.literal(direction === "asc" ? " asc" : " desc")])),
	);
	const found = yield* options.read({ limit: limit + 1, orderBy, seek });
	const rows = found.slice(0, limit);
	const last = rows.at(-1);
	return { next: found.length > limit && last !== undefined ? Option.some(options.cursorFor(last)) : Option.none(), rows };
});
