import { Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { answerAccess, answerMoves, answerVerbs } from "./answers.ts";
import { formStories } from "./formStories.ts";

const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String })) });
type Answer = (typeof Answers.Encoded)["answers"][number];

export const first: Answer = { id: "first", text: "Same" };
export const second: Answer = { id: "second", text: "Same" };
export const REJECTED_MESSAGE = "Rejected";

export const racingAnswers = formStories(() => Answers, {
	config: () => ({
		arrayKeys: { answers: (answer: Answer) => answer.id },
		initialValues: { answers: [first, second] },
		onSubmit: (_values, submitter, submitted) =>
			submitter.fail(["answers", submitted.answers.findIndex((answer) => answer.id === second.id), "text"], REJECTED_MESSAGE),
		runtime: Atom.runtime(Layer.empty),
	}),
	support: () => undefined,
	verbs: (driver, tell) => answerVerbs(answerAccess(driver), tell),
});

export function answersChanged(line: string, change: (answers: readonly Answer[]) => readonly Answer[]) {
	return racingAnswers.step(line, (driver) => driver.current().change("answers", change(driver.current().values.value.answers)));
}

export function secondMovedToFront() {
	return answersChanged("the second answer moves to the front", (answers) => answerMoves.moveToFront(answers, second.id));
}
