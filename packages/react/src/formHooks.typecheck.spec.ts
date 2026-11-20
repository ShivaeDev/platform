import type { Option } from "effect";
import { expectTypeOf } from "vitest";
import type { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { CreateOptions } from "#client/create.ts";
import type { EditorOptions } from "#client/editor.ts";
import type { useEditorExample, useOptionalFieldExample, useRejectionExample } from "#test/formHookExamples.ts";
import type { Described, NameRejected, query, StaleRejected, Title, TitleConflict } from "#test/formHookFixtures.ts";

interface Row {
	id: number;
	title: string;
}
type Fields = typeof Title.fields;
type Example = ReturnType<typeof useEditorExample>;
type Rejections = ReturnType<typeof useRejectionExample>;
type OptionalFields = ReturnType<typeof useOptionalFieldExample>;

expectTypeOf<Example["editor"]["failure"]>().toEqualTypeOf<Option.Option<"Rejected">>();
expectTypeOf<Example["editor"]["query"]["data"]>().toEqualTypeOf<Option.Option<Row>>();
expectTypeOf<Example["create"]["created"]>().toEqualTypeOf<Option.Option<Row>>();
expectTypeOf<Rejections["named"]["failure"]>().toEqualTypeOf<Option.Option<NameRejected>>();
expectTypeOf<Rejections["mapped"]["failure"]>().toEqualTypeOf<Option.Option<StaleRejected>>();
expectTypeOf<OptionalFields["mapped"]["failure"]>().toEqualTypeOf<Option.Option<Conflict>>();
expectTypeOf<OptionalFields["titled"]["failure"]>().toEqualTypeOf<Option.Option<TitleConflict>>();
expectTypeOf<OptionalFields["described"]["failure"]>().toEqualTypeOf<Option.Option<Described>>();

expectTypeOf<{ rejectField: () => { field: "missing"; message: string } }>().not.toExtend<
	Pick<CreateOptions<Fields, Row, "Rejected", never, never>, "rejectField">
>();
// A failure that names a field must say which form field it belongs to.
expectTypeOf<{ initialValues: { title: string } }>().not.toExtend<CreateOptions<Fields, never, StaleRejected, never, never>>();
expectTypeOf<{ query: typeof query }>().not.toExtend<EditorOptions<Fields, Row, never, Row, StaleRejected, never, never>>();
expectTypeOf<{ initialValues: { title: string } }>().toExtend<CreateOptions<Fields, never, Conflict, never, never>>();
