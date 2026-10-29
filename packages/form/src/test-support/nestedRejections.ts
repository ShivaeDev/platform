import { Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { answerAccess, answerMoves, answerVerbs } from "./answers.ts";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const EXPLAIN_MESSAGE = "Explain your choice";

export const notes = formStories(() => Schema.Struct({ note: Schema.optionalKey(Schema.String) }), {
	config: () => ({ initialValues: {}, onSubmit: (_values, submitter) => submitter.fail("note", EXPLAIN_MESSAGE), runtime }),
	support: () => undefined,
	verbs: () => ({}),
});

export const noteless = { id: "noteless" };
export const answerNotes = formStories(
	() => Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, note: Schema.optionalKey(Schema.String) })) }),
	{
		config: () => ({
			arrayKeys: { answers: (answer: { readonly id: string }) => answer.id },
			initialValues: { answers: [noteless] },
			onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "note"], EXPLAIN_MESSAGE),
			runtime,
		}),
		support: () => undefined,
		verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
	},
);

export function notelessAnswerRemoved() {
	return answerNotes.step("the noteless answer is removed", (driver) =>
		driver.current().change("answers", answerMoves.remove(driver.current().values.value.answers, noteless.id)),
	);
}

export const REJECTED_ELEMENT = "Rejected element";
export const numberedAnswers = formStories(
	() => Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.Number, text: Schema.String })) }),
	{
		config: () => ({
			arrayKeys: { answers: (answer: { readonly id: number }) => answer.id },
			initialValues: {
				answers: [
					{ id: 1, text: "One" },
					{ id: 2, text: "Two" },
				],
			},
			onSubmit: (_values, submitter) => submitter.fail(["answers", 0], REJECTED_ELEMENT),
			runtime,
		}),
		support: () => undefined,
		verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
	},
);
