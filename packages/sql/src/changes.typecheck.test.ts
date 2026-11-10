import { type Effect, Schema } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import { expectTypeOf } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { type ChangeDeclaration, changes } from "#changes.ts";

const notes = collection("notes", Schema.Number, { listId: Schema.Number });
const moved = changes({ notes: [notes.item(1), notes.bucket.listId(2)] });
const entries = collection("entries", Schema.Number, {}, { ownerDay: ["ownerId", "day"] });
expectTypeOf(changes({ entries: [entries.item(1), entries.bucket.ownerDay({ day: 1, ownerId: "alice" })] })).toEqualTypeOf<ChangeDeclaration>();

expectTypeOf(moved.record({ publication: "local" })).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient | Reactivity.Reactivity>>();

// @ts-expect-error Publication is an explicit choice between local and shared.
moved.record({ publication: false });
// @ts-expect-error A table key alone does not cover a raw write.
changes({ notes: [notes.list] });
