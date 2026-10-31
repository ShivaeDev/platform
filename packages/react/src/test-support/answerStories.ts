import { Effect } from "effect";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AnswerList } from "./AnswerList.tsx";
import { makeAnswerForm } from "./answerForm.ts";
import { clickButton, type Screen, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

type Answer = "first" | "second" | "third";

interface State {
	view?: Rendered;
}

function current(state: State) {
	if (!state.view) {
		throw new Error("No answer screen");
	}
	return state.view;
}

function answerVerbs(state: State, screen: Screen) {
	function click(label: string, line: string) {
		return screen.act(line, () => clickButton(current(state).container, label));
	}
	return {
		answer: (id: Answer, text: string) => screen.act(`answer ${id}: ${text}`, () => typeInput(current(state).container, id, text)),
		moveFirst: (id: Answer) => click(`Move ${id} first`, `move ${id} to the top`),
		remove: (id: Answer) => click(`Remove ${id}`, `remove ${id}`),
		save: () => click("Save", "save the answers"),
	};
}

export const answers = storyKit(
	screenKit(
		"answer screen",
		(): State => ({}),
		(state, screen) => ({
			...answerVerbs(state, screen),
			messages: () =>
				Effect.sync(() =>
					[...current(state).container.querySelectorAll("li")].map((item) => {
						const message = item.querySelector('[role="alert"]')?.textContent;
						return message === undefined ? item.getAttribute("data-answer") : `${item.getAttribute("data-answer")}: ${message}`;
					}),
				),
		}),
	),
);

function* open({ screen, state }: { readonly screen: Screen; readonly state: State }) {
	state.view = yield* screen.open(createElement(AnswerList, { form: makeAnswerForm() }));
}

export function answersShown() {
	return answers.trait("screen", "answers first and second filled in and third empty, on a server that closes third", open);
}

export function thirdRequired() {
	return answers.trait("screen", "the answers were saved while third was empty, so third shows Required", function* (engine) {
		yield* open(engine);
		yield* answerVerbs(engine.state, engine.screen).save();
	});
}

export function thirdRequiredAfterFirstRemoved() {
	return answers.trait("screen", "third shows Required after a save, and first was then removed", function* (engine) {
		yield* open(engine);
		const { remove, save } = answerVerbs(engine.state, engine.screen);
		yield* save();
		yield* remove("first");
	});
}

export function thirdFilledAndMovedFirst() {
	return answers.trait("screen", "third was answered and moved to the top", function* (engine) {
		yield* open(engine);
		const { answer, moveFirst } = answerVerbs(engine.state, engine.screen);
		yield* answer("third", "Valid");
		yield* moveFirst("third");
	});
}

export function thirdClosedByServer() {
	return answers.trait("screen", "third was answered and saved, and the server rejected it as closed", function* (engine) {
		yield* open(engine);
		const { answer, save } = answerVerbs(engine.state, engine.screen);
		yield* answer("third", "Valid");
		yield* save();
	});
}
