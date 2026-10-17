import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ selected: Schema.Array(Schema.String), text: Schema.String })) }).check(
	Schema.makeFilter((values) =>
		values.answers.flatMap((answer, index) =>
			answer.selected.length === 0 && !answer.text.trim() ? [{ issue: "Choose or write an answer", path: ["answers", index, "text"] }] : [],
		),
	),
);

export const memoizedAnswers = formStories(
	() => Answers,
	() => ({
		initialValues: { answers: [{ selected: [], text: "" }] },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const unanswered = formStories(
	() => Answers,
	() => ({
		initialValues: {
			answers: [
				{ selected: [], text: "" },
				{ selected: [], text: "" },
			],
		},
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const profiles = formStories(
	() => Schema.Struct({ profile: Schema.Struct({ name: Schema.NonEmptyString, other: Schema.String }) }),
	() => ({
		initialValues: { profile: { name: "", other: "" } },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
