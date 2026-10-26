import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const notes = formStories(
	() => Schema.Struct({ note: Schema.optionalKey(Schema.String) }),
	() => ({
		initialValues: {},
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const answerNotes = formStories(
	() => Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, note: Schema.optionalKey(Schema.String) })) }),
	() => ({
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [{ id: "one" }] },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const wholeAnswers = formStories(
	() => Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.Number, text: Schema.String })) }),
	() => ({
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: {
			answers: [
				{ id: 0, text: "One" },
				{ id: 1, text: "Two" },
			],
		},
		onSubmit: Effect.succeed,
		runtime,
	}),
);
