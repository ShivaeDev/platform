import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

export const names = formStories(
	() => Schema.Struct({ name: Schema.Trim }),
	() => ({
		initialValues: { name: "First" },
		onSubmit: Effect.succeed,
		runtime: Atom.runtime(Layer.empty),
	}),
);
export const entries = formStories(
	() => Schema.Struct({ name: Schema.Trim, note: Schema.String }),
	() => ({
		initialValues: { name: "First", note: "" },
		onSubmit: Effect.succeed,
		runtime: Atom.runtime(Layer.empty),
	}),
);
