import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { answerAccess, answerMoves, answerVerbs } from "./answers.ts";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })) });
type Answer = (typeof Answers.Encoded)["answers"][number];
const keyedById = { answers: (answer: Answer) => answer.id };

export const first: Answer = { id: "first", text: "One" };
export const second: Answer = { id: "second", text: "Two" };
export const empty: Answer = { id: "empty", text: "" };
export const closed: Answer = { id: "closed", text: "Closed" };
export const CLOSED_MESSAGE = "Answer is closed";

export const emptyAnswers = formStories(() => Answers, {
	config: () => ({ arrayKeys: keyedById, initialValues: { answers: [first, second, empty] }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
});

export const closedAnswers = formStories(() => Answers, {
	config: () => ({
		arrayKeys: keyedById,
		initialValues: { answers: [first, second, closed] },
		onSubmit: (_values, submitter, submitted) =>
			submitter.fail(["answers", submitted.answers.findIndex((answer) => answer.id === closed.id), "text"], CLOSED_MESSAGE),
		runtime,
	}),
	support: () => undefined,
	verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
});

export function closedAnswerWasRejected() {
	return closedAnswers.step("the server rejects the closed answer's text", (driver) => driver.submit());
}

export function closedAnswerWasCorrected() {
	return closedAnswers.step("the closed answer's text is corrected", (driver) =>
		driver.current().change("answers", answerMoves.edit(driver.current().values.value.answers, closed.id, { text: "Corrected" })),
	);
}

export function closedAnswerWasRemoved() {
	return closedAnswers.step("the closed answer is removed", (driver) =>
		driver.current().change("answers", answerMoves.remove(driver.current().values.value.answers, closed.id)),
	);
}

export const sameText: Answer = { id: "same text", text: first.text };
export const unkeyedAnswers = formStories(() => Answers, {
	config: () => ({
		initialValues: { answers: [first, sameText] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "text"], "Rejected"),
		runtime,
	}),
	support: () => undefined,
	verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
});
