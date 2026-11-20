import type { Option } from "effect";
import { expectTypeOf } from "vitest";
import type { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { CreateOptions } from "#client/create.ts";
import type { EditorOptions } from "#client/editor.ts";
import type { FormFailuresOption } from "#client/failures.ts";
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

type Checked<E> = FormFailuresOption<Fields, E, never, false>;
// A rejection the app declared needs a handler unless it can only name one of the form's fields.
expectTypeOf<{ initialValues: { title: string } }>().not.toExtend<
	CreateOptions<Fields, never, StaleRejected, never, never> & Checked<StaleRejected>
>();
expectTypeOf<{ query: typeof query }>().not.toExtend<EditorOptions<Fields, Row, never, Row, StaleRejected, never, never> & Checked<StaleRejected>>();
expectTypeOf<{ initialValues: { title: string } }>().toExtend<CreateOptions<Fields, never, Conflict, never, never> & Checked<Conflict>>();
expectTypeOf<{ initialValues: { title: string } }>().toExtend<CreateOptions<Fields, never, NameRejected, never, never> & Checked<NameRejected>>();
