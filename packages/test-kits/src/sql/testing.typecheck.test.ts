import { type Effect, Schema } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { changes } from "@shivaedev/sql/changes.ts";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import { expectPublished, type PublishedKeysMismatch, type UnannouncedWrites, withChangeCoverage } from "#sql/testing.ts";

const notes = collection("notes", Schema.Number, { listId: Schema.Number });
const moved = changes({ notes: [notes.item(1), notes.bucket.listId(2)] });
declare const body: Effect.Effect<number, "rejected">;

const covered = withTestTransaction(withChangeCoverage(body, moved));
expectTypeOf(covered).toEqualTypeOf<
	Effect.Effect<number, "rejected" | SqlError | Schema.SchemaError | UnannouncedWrites, SqlClient.SqlClient | Reactivity.Reactivity>
>();

const published = withTestTransaction(body.pipe(expectPublished((id) => [notes.item(id)])));
expectTypeOf(published).toEqualTypeOf<
	Effect.Effect<number, "rejected" | SqlError | PublishedKeysMismatch, SqlClient.SqlClient | Reactivity.Reactivity>
>();
