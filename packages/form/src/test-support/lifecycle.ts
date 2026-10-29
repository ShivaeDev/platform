import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);

export const names = formStories(() => Schema.Struct({ name: Schema.Trim }), {
	config: () => ({ initialValues: { name: "First" }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: () => ({}),
});

export const entries = formStories(() => Schema.Struct({ name: Schema.Trim, note: Schema.String }), {
	config: () => ({ initialValues: { name: "First", note: "" }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: () => ({}),
});
