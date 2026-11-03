import { Context, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import { type KeysetPage, keysetPage } from "#keysetPage.ts";

class Decoder extends Context.Service<Decoder, string>()("@shivaedev/sql/KeysetDecoder") {}
const Row = Schema.Struct({ id: Schema.Number, name: Schema.String });
type Row = typeof Row.Type;
interface Cursor {
	readonly id: number;
}

const program = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const options = {
		cursorFor: (row: Row): Cursor => ({ id: row.id }),
		limit: 2,
		orderBy: [],
		read: () =>
			Effect.gen(function* () {
				yield* Decoder;
				return yield* sql`select id, name from notes`.pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Row))));
			}),
		tieBreaker: { column: "id", direction: "asc", value: (cursor: Cursor) => cursor.id },
	} as const;
	const page = keysetPage(options);
	expectTypeOf<Effect.Success<typeof page>>().toEqualTypeOf<KeysetPage<Row, Cursor>>();
	expectTypeOf<Effect.Error<typeof page>>().toEqualTypeOf<SqlError | Schema.SchemaError>();
	expectTypeOf<Effect.Services<typeof page>>().toEqualTypeOf<SqlClient.SqlClient | Decoder>();
	// @ts-expect-error A unique tie-breaker is required even without other ordering.
	keysetPage({ cursorFor: options.cursorFor, limit: 2, orderBy: [], read: options.read });
	// @ts-expect-error Directions must be ascending or descending.
	keysetPage({ ...options, tieBreaker: { ...options.tieBreaker, direction: "sideways" } });
	// @ts-expect-error Decoded dates cannot preserve timestamp cursor microseconds.
	keysetPage({ ...options, tieBreaker: { ...options.tieBreaker, value: () => new Date(0) } });
	// @ts-expect-error Null sort values need an explicit non-null SQL expression.
	keysetPage({ ...options, tieBreaker: { ...options.tieBreaker, value: () => null } });
});

it("keyset pages retain caller row, cursor, error and service types", () => {
	expectTypeOf(program).toBeObject();
});
