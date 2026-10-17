import { Data, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const first = { id: "first", text: "One" };
export const second = { id: "second", text: "Two" };
export const third = { id: "third", text: "" };
const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })) });
class AnswerRejected extends Data.TaggedError("AnswerRejected")<{ readonly index: number; readonly message: string }> {}

export const schemaAnswers = formStories(
	() => Answers,
	() => ({
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second, third] },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const rejectedAnswers = formStories(
	() => Answers,
	() => ({
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [first, second, { ...third, text: "Rejected" }] },
		onSubmit: (_values, submitter) =>
			Effect.fail(new AnswerRejected({ index: 2, message: "Answer is closed" })).pipe(
				Effect.catchTag("AnswerRejected", (reason) => submitter.fail(["answers", reason.index, "text"], reason.message)),
			),
		runtime,
	}),
);
export const indexedAnswers = formStories(
	() => Answers,
	() => ({
		initialValues: { answers: [first, { id: "second", text: "One" }] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "text"], "Rejected"),
		runtime,
	}),
);
