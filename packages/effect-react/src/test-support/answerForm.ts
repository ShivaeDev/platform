import { Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";

export const answerValues = {
	first: { id: "first", text: "One" },
	second: { id: "second", text: "Two" },
	third: { id: "third", text: "" },
};

export function makeAnswerForm() {
	return make(Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })) }), {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: Object.values(answerValues) },
		onSubmit: (values, submitter) =>
			submitter.fail(["answers", values.answers.findIndex((answer) => answer.id === "third"), "text"], "Answer is closed"),
		runtime: Atom.runtime(Layer.empty),
	});
}
