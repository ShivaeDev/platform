import { Context, Data, type Effect } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { type InvalidationKeys, invalidateOnCommit, transact } from "#transact.ts";

class Rejected extends Data.TaggedError("Rejected") {}
class Unavailable extends Data.TaggedError("Unavailable") {}
class Orders extends Context.Service<Orders, number>()("@shivaedev/sql/test/Orders") {}
declare const keys: InvalidationKeys;
declare const body: Effect.Effect<string, Rejected | SqlError, Orders>;
declare const withoutSql: Effect.Effect<string, Rejected, Orders>;

type Transacted = Effect.Effect<string, Rejected | Unavailable, Orders | SqlClient.SqlClient | Reactivity.Reactivity>;
type Unmapped = Effect.Effect<string, Rejected | SqlError, Orders | SqlClient.SqlClient | Reactivity.Reactivity>;

expectTypeOf(transact(body, { onSqlError: () => new Unavailable() })).toEqualTypeOf<Transacted>();
expectTypeOf(body.pipe(transact({ onSqlError: () => new Unavailable() }))).toEqualTypeOf<Transacted>();
expectTypeOf(transact(body)).toEqualTypeOf<Unmapped>();
expectTypeOf(body.pipe(transact())).toEqualTypeOf<Unmapped>();
expectTypeOf(transact(withoutSql)).toEqualTypeOf<Unmapped>();
expectTypeOf(withoutSql.pipe(transact())).toEqualTypeOf<Unmapped>();
expectTypeOf(invalidateOnCommit(keys)).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient | Reactivity.Reactivity>>();
expectTypeOf(invalidateOnCommit(keys, { publication: "local" })).toEqualTypeOf<
	Effect.Effect<void, never, SqlClient.SqlClient | Reactivity.Reactivity>
>();
