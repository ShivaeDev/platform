import { Effect, Schema, Scope } from "effect";
import { AtomRegistry } from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { formStories } from "./formStories.ts";

export const names = formStories(() => Schema.Struct({ name: Schema.Trim }), {
	config: () => ({ initialValues: { name: "First" }, onSubmit: Effect.succeed }),
	support: () => undefined,
	verbs: () => ({}),
});

export const entries = formStories(() => Schema.Struct({ name: Schema.Trim, note: Schema.String }), {
	config: () => ({ initialValues: { name: "First", note: "" }, onSubmit: Effect.succeed }),
	support: () => undefined,
	verbs: () => ({}),
});

export const nativeNames = formStories(() => Schema.Struct({ name: Schema.String }), {
	config: () => ({
		initialValues: { name: "First" },
		onSubmit: (values) =>
			Effect.gen(function* () {
				yield* Scope.Scope;
				yield* AtomRegistry;
				yield* Reactivity.invalidate(["profile"]);
				return values;
			}),
	}),
	support: () => undefined,
	verbs: () => ({}),
});
