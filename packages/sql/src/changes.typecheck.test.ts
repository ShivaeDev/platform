import { type Effect, Schema } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import { expectTypeOf } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { changes } from "#changes.ts";
import { withChangeCoverage } from "#testing.ts";

const notes = collection("notes", Schema.Number, { listId: Schema.Number });
const moved = changes({ notes: [notes.item(1), notes.bucket.listId(2)] });
declare const body: Effect.Effect<void>;

expectTypeOf(moved.record({ publication: "local" })).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient | Reactivity.Reactivity>>();
withChangeCoverage(body, moved);

// @ts-expect-error Publication is an explicit choice between local and shared.
moved.record({ publication: false });
// @ts-expect-error A table key alone does not cover a raw write.
changes({ notes: [notes.list] });
