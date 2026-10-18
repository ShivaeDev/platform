import { createElement } from "react";
import type { Rendered } from "#testing.ts";
import { AnswerList } from "./AnswerList.tsx";
import { makeAnswerForm } from "./answerForm.ts";
import { clickButton, screenKit, typeInput } from "./screenKit.ts";

interface State {
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No answer screen");
	}
	return state.view;
}
export const answers = screenKit(
	"answer screen",
	(): State => ({}),
	(state, screen) => ({
		click: (label: string) => screen.act(`click ${label}`, () => clickButton(current(state).container, label)),
		list: () => current(state).container,
		type: (id: string, text: string) => screen.act(`answer ${id}: ${text}`, () => typeInput(current(state).container, id, text)),
	}),
);
export function answerList() {
	return answers.trait("screen", "three editable answers", function* ({ screen, state }) {
		state.view = yield* screen.open(createElement(AnswerList, { form: makeAnswerForm() }));
	});
}
