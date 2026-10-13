import { Context, Effect, Layer, Schema, Scope } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { AtomRegistry } from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { make } from "#form.ts";
import { FieldFailure } from "#shape.ts";

const runtime = Atom.runtime(Layer.empty);
const fields = Schema.Struct({ name: Schema.String });

make(fields, {
	initialValues: { name: "" },
	onSubmit: (values) =>
		Effect.gen(function* () {
			yield* Scope.Scope;
			yield* AtomRegistry;
			yield* Reactivity.invalidate(["profile"]);
			return values;
		}),
	runtime,
});

class Secret extends Context.Service<Secret, { readonly value: string }>()("test/Secret") {}

make(fields, {
	initialValues: { name: "" },
	// @ts-expect-error The native runtime services do not provide application dependencies.
	onSubmit: () => Secret,
	runtime,
});

const nested = make(fields, { initialValues: { name: "" }, onSubmit: Effect.succeed, runtime });
const message: Atom.Atom<string | undefined> = nested.errorAt(["name"]);
void message;
// @ts-expect-error Nested feedback must begin with a top-level schema field.
nested.errorAt(["missing", 0]);

const legacyFailure = new FieldFailure({ message: "Rejected", path: "name" });
const legacyPath: string = legacyFailure.path;
void legacyPath;

make(Schema.Struct({ answers: Schema.Array(Schema.Struct({ count: Schema.NumberFromString, id: Schema.String })) }), {
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

make(fields, {
	arrayKeys: {
		// @ts-expect-error Only array fields accept key selectors.
		name: () => "key",
	},
	initialValues: { name: "" },
	onSubmit: Effect.succeed,
	runtime,
});
