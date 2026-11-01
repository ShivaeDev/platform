import { Schema } from "effect";
import { expectTypeOf } from "vitest";
import { bucket } from "#buckets.ts";
import { collection } from "#keys.ts";

const notes = collection("notes", Schema.Number, { listId: Schema.Number, userId: Schema.String });
expectTypeOf(notes.bucket.userId).parameter(0).toEqualTypeOf<string>();
expectTypeOf(notes.bucket.listId).parameter(0).toEqualTypeOf<number>();
// @ts-expect-error Bucket values use the declared field schema.
notes.bucket.listId("42");
// @ts-expect-error A query cannot name an undeclared bucket.
notes.bucket.teamId("team");

// @ts-expect-error Boolean values cannot be represented by a bucket key.
collection("notes", Schema.Number, { active: Schema.Boolean });
// @ts-expect-error Bigint values cannot be represented by a bucket key.
collection("notes", Schema.Number, { sequence: Schema.BigInt });
// @ts-expect-error Object values cannot be represented by a bucket key.
collection("notes", Schema.Number, { owner: Schema.Struct({ id: Schema.String }) });
// @ts-expect-error Dates cannot be represented by a bucket key.
collection("notes", Schema.Number, { created: Schema.Date });
// @ts-expect-error Model bucket codecs must decode to key values.
bucket(Schema.BigIntFromString);

const encodedNotes = collection("notes", Schema.Number, { listId: Schema.NumberFromString, owner: Schema.String.pipe(Schema.brand("Owner")) });
expectTypeOf(encodedNotes.bucket.listId).parameter(0).toEqualTypeOf<number>();
