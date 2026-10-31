import { Context, Effect, Layer, Schema, SchemaGetter, Scope } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { AtomRegistry } from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { form } from "#form.ts";
import { FieldFailure, type Invalid } from "#shape.ts";

const runtime = Atom.runtime(Layer.empty);
const Fields = Schema.Struct({ name: Schema.String });

form(Fields, {
	initialValues: { name: "" },
	onSubmit: Effect.succeed,
	// @ts-expect-error Required messages must name an existing field.
	requiredMessages: { missing: "Enter a name" },
});

form(Schema.Struct({ count: Schema.Number }), {
	initialValues: { count: 0 },
	onSubmit: Effect.succeed,
	// @ts-expect-error Required messages configure string fields.
	requiredMessages: { count: "Enter a count" },
});

form(Fields, {
	initialValues: { name: "" },
	onSubmit: (values) =>
		Effect.gen(function* () {
			yield* Scope.Scope;
			yield* AtomRegistry;
			yield* Reactivity.invalidate(["profile"]);
			return values;
		}),
});

class Secret extends Context.Service<Secret, { readonly value: string }>()("test/Secret") {}

// @ts-expect-error Application services require an explicit runtime.
form(Fields, { initialValues: { name: "" }, onSubmit: () => Secret });

form(Fields, {
	initialValues: { name: "" },
	// @ts-expect-error The native runtime services do not provide application dependencies.
	onSubmit: () => Secret,
	runtime,
});

const nested = form(Fields, { initialValues: { name: "" }, onSubmit: Effect.succeed, runtime });
const message: Atom.Atom<string | undefined> = nested.errorAt(["name"]);
void message;
// @ts-expect-error Nested feedback must begin with a top-level schema field.
nested.errorAt(["missing", 0]);

const legacyFailure = new FieldFailure({ message: "Rejected", path: "name" });
const legacyPath: string = legacyFailure.path;
void legacyPath;

form(Schema.Struct({ answers: Schema.Array(Schema.Struct({ count: Schema.NumberFromString, id: Schema.String })) }), {
	arrayKeys: {
		answers: (answer) => {
			const encoded: string = answer.count;
			void encoded;
			// @ts-expect-error Key selectors receive encoded elements.
			const decoded: number = answer.count;
			void decoded;
			return answer.id;
		},
	},
	initialValues: { answers: [] },
	onSubmit: (_values, submitter) => {
		// @ts-expect-error Rejection paths must begin with a schema field.
		submitter.fail(["missing", 0], "Rejected");
		return submitter.fail(["answers", 0, "count"], "Rejected");
	},
	runtime,
});

form(Fields, {
	arrayKeys: {
		// @ts-expect-error Only array fields accept key selectors.
		name: () => "key",
	},
	initialValues: { name: "" },
	onSubmit: Effect.succeed,
	runtime,
});

// @ts-expect-error Advisory checks that read application services require a runtime.
form(Fields, { checks: { name: () => Effect.as(Secret, undefined) }, initialValues: { name: "" }, onSubmit: Effect.succeed });

const SecretName = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((name) => Effect.as(Secret, name)),
		encode: SchemaGetter.passthrough(),
	}),
);
// @ts-expect-error Schema decoding services require a runtime even for a service-free handler.
form(Schema.Struct({ name: SecretName }), { initialValues: { name: "" }, onSubmit: Effect.succeed });

const secretRuntime = Atom.runtime(Layer.succeed(Secret)({ value: "secret" }));
form(Schema.Struct({ name: SecretName }), {
	checks: { name: () => Effect.as(Secret, undefined) },
	initialValues: { name: "" },
	onSubmit: () => Secret,
	runtime: secretRuntime,
});

const withoutRuntime = form(Fields, {
	initialValues: { name: "" },
	onSubmit: (values) => (values.name === "" ? Effect.fail("Missing" as const) : Effect.succeed(values.name)),
});
const typedSubmission: Atom.AtomResultFn<void, string, "Missing" | FieldFailure | Invalid> = withoutRuntime.submit;
void typedSubmission;
