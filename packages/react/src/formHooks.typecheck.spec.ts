import type { Option } from "effect";
import { expectTypeOf } from "vitest";
import type { CreateConfig } from "#client/create.ts";
import type { EditorConfig } from "#client/editor.ts";
import type { useEditorExample, useOptionalFieldExample, useRejectionExample } from "#test/formHookExamples.ts";
import type {
	Conflict,
	Described,
	NameRejected,
	query,
	runtime,
	StaleRejected,
	saveConflict,
	saveStale,
	Title,
	TitleConflict,
} from "#test/formHookFixtures.ts";

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
	Pick<CreateConfig<Fields, Row, "Rejected", never, never>, "rejectField">
>();
expectTypeOf<{ create: typeof saveStale; fields: typeof Title; initialValues: { title: string }; runtime: typeof runtime }>().not.toExtend<
	CreateConfig<Fields, never, StaleRejected, never, never>
>();
expectTypeOf<{
	fields: typeof Title;
	query: typeof query;
	runtime: typeof runtime;
	save: typeof saveStale;
	values: (record: Row) => { title: string };
}>().not.toExtend<EditorConfig<Fields, Row, never, StaleRejected, never, never>>();
expectTypeOf<{ create: typeof saveConflict; fields: typeof Title; initialValues: { title: string }; runtime: typeof runtime }>().not.toExtend<
	CreateConfig<Fields, never, Conflict, never, never>
>();
