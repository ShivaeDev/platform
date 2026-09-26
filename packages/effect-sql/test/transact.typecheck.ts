import { Context, Data, type Effect } from "effect";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { expectTypeOf } from "vitest";
import { type InvalidationKeys, invalidateOnCommit, transact } from "../src/index.ts";

class Rejected extends Data.TaggedError("Rejected") {}
class Unavailable extends Data.TaggedError("Unavailable") {}
class Meals extends Context.Service<Meals, number>()("test/Meals") {}
declare const body: Effect.Effect<string, Rejected | SqlError, Meals>;

type Transacted = Effect.Effect<string, Rejected | Unavailable, Meals | SqlClient.SqlClient | Reactivity.Reactivity>;

expectTypeOf(transact(body, { onSqlError: () => new Unavailable() })).toEqualTypeOf<Transacted>();
expectTypeOf(body.pipe(transact({ onSqlError: () => new Unavailable() }))).toEqualTypeOf<Transacted>();
expectTypeOf(invalidateOnCommit).parameters.toEqualTypeOf<[keys: InvalidationKeys]>();
expectTypeOf(invalidateOnCommit(["meals"])).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient | Reactivity.Reactivity>>();
