import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { CreateSubmitView, EditorSubmitView, type SubmitState } from "./submitViews.tsx";

interface State extends SubmitState {
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No submission screen");
	}
	return state.view;
}
export const submissions = storyKit(
	screenKit(
		"form submission screen",
		(): State => ({ decoding: Promise.withResolvers<void>(), names: [] }),
		(state, screen) => ({
			fieldError: () => current(state).container.querySelector('[role="alert"]')?.textContent,
			finishDecode: () => screen.act("the asynchronous Schema decoder finishes", () => state.decoding.resolve()),
			names: () => state.names,
			snapshot: () => JSON.parse(current(state).container.querySelector("output")?.textContent ?? "null"),
			submit: (method: "Form submit" | "Atom submit" | "Save") =>
				screen.act(`submit with ${method}`, () => clickButton(current(state).container, method)),
			type: (value: string) => screen.act(`type name: ${value}`, () => typeInput(current(state).container, "name", value)),
		}),
	),
);
export function submissionForm(kind: "create" | "slow" | "editor" | "rejected" = "create") {
	return submissions.trait("screen", `a ${kind} form with native submit controls`, function* ({ screen, state }) {
		state.view = yield* screen.open(
			kind === "editor"
				? createElement(EditorSubmitView)
				: createElement(CreateSubmitView, { rejected: kind === "rejected", slow: kind === "slow", state }),
		);
	});
}
