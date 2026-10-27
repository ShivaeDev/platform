import { Data, Effect } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { mapSqlError } from "#mapSqlError.ts";
import { transact } from "#transact.ts";

class NameTaken extends Data.TaggedError("NameTaken") {}
class ParentMissing extends Data.TaggedError("ParentMissing") {}
class InvalidQuantity extends Data.TaggedError("InvalidQuantity") {}
class Unavailable extends Data.TaggedError("Unavailable") {}
class Rejected extends Data.TaggedError("Rejected") {}

const mapper = mapSqlError({
	constraints: {
		"items_name_key": () => new NameTaken(),
		"items_parent_fkey": () => new ParentMissing(),
		"items_quantity_check": () => new InvalidQuantity(),
	},
	fallback: () => new Unavailable(),
});
type DomainError = NameTaken | ParentMissing | InvalidQuantity | Unavailable;
expectTypeOf<ReturnType<typeof mapper>>().toEqualTypeOf<DomainError>();

function genericPipeline<A, R>(write: Effect.Effect<A, SqlError, R>) {
	const mapped = write.pipe(Effect.mapError(mapper));
	expectTypeOf(mapped).toEqualTypeOf<Effect.Effect<A, DomainError, R>>();
	return mapped;
}
function genericTransaction<A, R>(write: Effect.Effect<A, SqlError | Rejected, R>) {
	const mapped = write.pipe(transact({ onSqlError: mapper }));
	expectTypeOf(mapped).toEqualTypeOf<Effect.Effect<A, DomainError | Rejected, R | SqlClient.SqlClient | Reactivity.Reactivity>>();
	return mapped;
}
function genericMapping<TUnique, TForeign, TCheck, TFallback>(
	unique: (error: SqlError) => TUnique,
	foreign: (error: SqlError) => TForeign,
	check: (error: SqlError) => TCheck,
	fallback: (error: SqlError) => TFallback,
) {
	const map = mapSqlError({ constraints: { "items_name_key": unique, "items_parent_fkey": foreign, "items_quantity_check": check }, fallback });
	const checked: (error: SqlError) => TUnique | TForeign | TCheck | TFallback = map;
	return checked;
}
expectTypeOf(genericPipeline).toBeFunction();
expectTypeOf(genericTransaction).toBeFunction();
expectTypeOf(genericMapping).toBeFunction();
