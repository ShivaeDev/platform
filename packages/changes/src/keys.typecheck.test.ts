import { Schema } from "effect";
import { expectTypeOf } from "vitest";
import { bucket } from "#buckets.ts";
import { collection, type Identity } from "#keys.ts";

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

const entries = collection("entries", Schema.Number, { ownerId: Schema.String }, { ownerDay: ["ownerId", "day"] });
expectTypeOf(entries.bucket.ownerDay).parameter(0).toEqualTypeOf<{ readonly day: Identity; readonly ownerId: string }>();
// @ts-expect-error A tuple key needs a value for every column of the tuple.
entries.bucket.ownerDay({ ownerId: "alice" });
// @ts-expect-error A tuple column declared as a single-column bucket keeps its schema type.
entries.bucket.ownerDay({ day: 1, ownerId: 7 });
// @ts-expect-error A tuple spans at least two columns.
collection("entries", Schema.Number, {}, { owner: ["ownerId"] });
// @ts-expect-error A tuple cannot take the name of a single-column bucket.
collection("entries", Schema.Number, { ownerId: Schema.String }, { ownerId: ["ownerId", "day"] });
