import { Context, Effect, Layer, type Option, Schema, SchemaGetter } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { expectTypeOf } from "vitest";
import { type CreateOptions, useCreate } from "#client/create.ts";
import { type EditorOptions, useEditor } from "#client/editor.ts";
import { type SubmissionConfig, submission } from "#submission.ts";

class Check extends Context.Service<Check, { readonly message: string }>()("@shivaedev/react/test/Check") {}
class Decode extends Context.Service<Decode, { readonly prefix: string }>()("@shivaedev/react/test/Decode") {}
const Draft = Schema.Struct({
	answers: Schema.Array(Schema.Struct({ count: Schema.NumberFromString, id: Schema.String })),
	count: Schema.Number,
	title: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transformEffect((title) => Effect.map(Decode, ({ prefix }) => prefix + title)),
			encode: SchemaGetter.passthrough(),
		}),
	),
});
const initialValues = { answers: [{ count: "1", id: "first" }], count: 1, title: "" };
const query = Atom.make(AsyncResult.success(initialValues));
const runtime = Atom.runtime(Layer.merge(Layer.succeed(Check)({ message: "Taken" }), Layer.succeed(Decode)({ prefix: "" })));
const emptyRuntime = Atom.runtime(Layer.empty);
const decodeRuntime = Atom.runtime(Layer.succeed(Decode)({ prefix: "" }));
type Fields = typeof Draft.fields;
type Values = typeof Draft.Type;
function create(values: Values) {
	expectTypeOf(values.answers[0]?.count).toEqualTypeOf<number | undefined>();
	return Effect.succeed(values.title);
}
function save(values: Values) {
	return Effect.succeed({ ...initialValues, title: values.title });
}

export function useFormOptionsExamples() {
	const config = { debounce: "20 millis" as const, fields: Draft, initialValues, requiredMessages: { title: "Enter a title" } };
	const created = useCreate(
		{ run: create, runtime },
		{
			...config,
			arrayKeys: {
				answers: (answer) => {
					expectTypeOf(answer.count).toEqualTypeOf<string>();
					return answer.id;
				},
			},
			checks: {
				title: (value) => {
					expectTypeOf(value).toEqualTypeOf<string>();
					return Effect.map(Check, ({ message }) => message);
				},
			},
		},
	);
	const editor = useEditor(
		{ run: save, runtime },
		{
			...config,
			arrayKeys: {
				answers: (answer) => {
					expectTypeOf(answer.count).toEqualTypeOf<string>();
					return answer.id;
				},
			},
			checks: {
				title: (value) => {
					expectTypeOf(value).toEqualTypeOf<string>();
					return Effect.map(Check, ({ message }) => message);
				},
			},
			query,
			values: (row) => row,
		},
	);
	const submitted = submission({
		...config,
		arrayKeys: {
			answers: (answer) => {
				expectTypeOf(answer.count).toEqualTypeOf<string>();
				return answer.id;
			},
		},
		checks: {
			title: (value) => {
				expectTypeOf(value).toEqualTypeOf<string>();
				return Effect.map(Check, ({ message }) => message);
			},
		},
		runtime,
		save: (values) => Effect.succeed(values.title),
	});
	expectTypeOf(created.created).toEqualTypeOf<Option.Option<string>>();
	expectTypeOf(editor.query.data).toEqualTypeOf<Option.Option<typeof initialValues>>();
	const missingCheck = { checks: { title: () => Effect.map(Check, ({ message }) => message) }, fields: Draft, initialValues };
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	useCreate({ run: create, runtime: decodeRuntime }, missingCheck);
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	useEditor({ run: save, runtime: decodeRuntime }, { ...missingCheck, query, values: (row) => row });
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	submission({ ...missingCheck, runtime: decodeRuntime, save: Effect.succeed });
	return { created, editor, submitted };
}

type Configs =
	| CreateOptions<Fields, string, never, Check, never>
	| EditorOptions<Fields, string, never, string, never, Check, never>
	| SubmissionConfig<Fields, string, never, Check, never>;
expectTypeOf<{ requiredMessages: { missing: string } }>().not.toExtend<Pick<Configs, "requiredMessages">>();
expectTypeOf<{ requiredMessages: { count: string } }>().not.toExtend<Pick<Configs, "requiredMessages">>();
expectTypeOf<{ checks: { missing: (value: string) => Effect.Effect<undefined> } }>().not.toExtend<Pick<Configs, "checks">>();
expectTypeOf<{ arrayKeys: { title: (value: string) => string } }>().not.toExtend<Pick<Configs, "arrayKeys">>();
expectTypeOf<{ runtime: typeof emptyRuntime }>().not.toExtend<Pick<SubmissionConfig<Fields, string, never, Check, never>, "runtime">>();
