import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { AnswerList } from "./AnswerList.tsx";
import { makeAnswerForm } from "./answerForm.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No answer screen");
	}
	return state.view;
}
export const answers = storyKit(
	screenKit(
		"answer screen",
		(): State => ({}),
		(state, screen) => ({
			click: (label: string) => screen.act(`click ${label}`, () => clickButton(current(state).container, label)),
			messages: () =>
				[...current(state).container.querySelectorAll("li")].map((item) => [
					item.getAttribute("data-answer"),
					item.querySelector('[role="alert"]')?.textContent,
				]),
			type: (id: string, text: string) => screen.act(`answer ${id}: ${text}`, () => typeInput(current(state).container, id, text)),
		}),
	),
);
export function answerList() {
	return answers.trait("screen", "three editable answers", function* ({ screen, state }) {
		state.view = yield* screen.open(createElement(AnswerList, { form: makeAnswerForm() }));
	});
}
