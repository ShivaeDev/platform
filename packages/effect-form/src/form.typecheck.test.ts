import { Context, Effect, Layer, Schema, Scope } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { AtomRegistry } from "effect/unstable/reactivity/AtomRegistry";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { make } from "#form.ts";

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
