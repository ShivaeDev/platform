import { Context, Effect, Layer, type Option, Schema, SchemaGetter } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { expectTypeOf } from "vitest";
import type { CreateConfig } from "#client/create.ts";
import { useCreate } from "#client/create.ts";
import type { EditorConfig } from "#client/editor.ts";
import { useEditor } from "#client/editor.ts";
import { type SubmissionConfig, submission } from "#submission.ts";

class Check extends Context.Service<Check, { readonly message: string }>()("test/Check") {}
class Decode extends Context.Service<Decode, { readonly prefix: string }>()("test/Decode") {}
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

export function useFormOptionsExamples() {
	const config = { debounce: "20 millis" as const, fields: Draft, initialValues, requiredMessages: { title: "Enter a title" }, runtime };
	const create = useCreate({
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
		create: (values) => {
			expectTypeOf(values.answers[0]?.count).toEqualTypeOf<number | undefined>();
			return Effect.succeed(values.title);
		},
	});
	const editor = useEditor({
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
		save: (values) => Effect.succeed({ ...initialValues, title: values.title }),
		values: (row) => row,
	});
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
		rejectField: undefined,
		save: (values) => Effect.succeed(values.title),
	});
	expectTypeOf(create.created).toEqualTypeOf<Option.Option<string>>();
	expectTypeOf(editor.query.data).toEqualTypeOf<Option.Option<typeof initialValues>>();
	const missingCheck = { checks: { title: () => Effect.map(Check, ({ message }) => message) }, fields: Draft, initialValues, runtime: decodeRuntime };
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	useCreate({ ...missingCheck, create: Effect.succeed });
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	useEditor({ ...missingCheck, query, save: () => Effect.succeed(initialValues), values: (row) => row });
	// @ts-expect-error Checks need their service in addition to schema decoding services.
	submission({ ...missingCheck, rejectField: undefined, save: Effect.succeed });
	return { create, editor, submitted };
}

type Configs =
	| CreateConfig<Fields, string, never, Check, never>
	| EditorConfig<Fields, string, never, never, Check, never>
	| SubmissionConfig<Fields, string, never, Check, never>;
expectTypeOf<{ requiredMessages: { missing: string } }>().not.toExtend<Pick<Configs, "requiredMessages">>();
expectTypeOf<{ requiredMessages: { count: string } }>().not.toExtend<Pick<Configs, "requiredMessages">>();
expectTypeOf<{ checks: { missing: (value: string) => Effect.Effect<undefined> } }>().not.toExtend<Pick<Configs, "checks">>();
expectTypeOf<{ arrayKeys: { title: (value: string) => string } }>().not.toExtend<Pick<Configs, "arrayKeys">>();
expectTypeOf<{ runtime: typeof emptyRuntime }>().not.toExtend<Pick<Configs, "runtime">>();
