import { Schema } from "effect";
import { expectTypeOf } from "vitest";
import { collection } from "#keys.ts";

const notes = collection("notes", Schema.Number, { listId: Schema.Number, userId: Schema.String });
expectTypeOf(notes.bucket.userId).parameter(0).toEqualTypeOf<string>();
expectTypeOf(notes.bucket.listId).parameter(0).toEqualTypeOf<number>();
// @ts-expect-error Bucket values use the declared field schema.
notes.bucket.listId("42");
// @ts-expect-error A query cannot name an undeclared bucket.
notes.bucket.teamId("team");
