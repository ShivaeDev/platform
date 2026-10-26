import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

export const first = { id: "first", text: "Same" };
export const second = { id: "second", text: "Same" };
export const racingAnswers = formStories(
	() => Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String })) }),
	() => ({
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second] },
		onSubmit: Effect.succeed,
		runtime: Atom.runtime(Layer.empty),
	}),
);
