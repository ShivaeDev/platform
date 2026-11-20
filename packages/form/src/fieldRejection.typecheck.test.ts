import { Data, Schema } from "effect";
import { expectTypeOf } from "vitest";
import type { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { FieldRejectionMapping, RejectField } from "#fieldRejection.ts";

const Fields = Schema.Struct({ title: Schema.String });
type TitleFields = typeof Fields.fields;
type Unmapped = Record<never, never>;

class Invalid extends Data.TaggedError("Invalid")<{ readonly field: string; readonly message: string }> {}
class Stale extends Data.TaggedError("Stale")<{ readonly field: "subtitle" | "title"; readonly message: string }> {}
class Renamed extends Data.TaggedError("Renamed")<{ readonly field?: "heading"; readonly message: string }> {}

expectTypeOf<Unmapped>().toExtend<FieldRejectionMapping<TitleFields, Conflict>>();
expectTypeOf<Unmapped>().toExtend<FieldRejectionMapping<TitleFields, Invalid>>();
expectTypeOf<Unmapped>().toExtend<FieldRejectionMapping<TitleFields, BadRequest | Conflict>>();
expectTypeOf<{ rejectField: RejectField<TitleFields, Conflict> }>().toExtend<FieldRejectionMapping<TitleFields, Conflict>>();

expectTypeOf<Unmapped>().not.toExtend<FieldRejectionMapping<TitleFields, Stale>>();
expectTypeOf<Unmapped>().not.toExtend<FieldRejectionMapping<TitleFields, Renamed>>();
expectTypeOf<Unmapped>().not.toExtend<FieldRejectionMapping<TitleFields, Conflict | Stale>>();
expectTypeOf<{ rejectField: RejectField<TitleFields, Stale> }>().toExtend<FieldRejectionMapping<TitleFields, Stale>>();
