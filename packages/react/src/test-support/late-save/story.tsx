import { Effect } from "effect";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, type Screen, typeInput } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { model } from "./model.ts";
import { Create, Editor } from "./view.tsx";

interface State {
	readonly model: ReturnType<typeof model>;
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No late save screen is open");
	}
	return state.view;
}
function shown(state: State): { readonly dirty: boolean; readonly values: { readonly name: string; readonly note?: string } } {
	return JSON.parse(current(state).container.querySelector("output")?.textContent ?? "null");
}
function verbs(state: State, screen: Screen) {
	return {
		click: (label: string) => screen.act(`click ${label}`, () => clickButton(current(state).container, label)),
		finish: () =>
			screen
				.act("the save responds", () => state.model.complete.resolve())
				.pipe(
					Effect.andThen(
						Effect.suspend(() =>
							settleScreen(current(state).container, () => current(state).container.querySelector('[data-saving="true"]') !== null, screen.tell),
						),
					),
				),
		type: (name: string, value: string) => screen.act(`type ${name}: ${value}`, () => typeInput(current(state).container, name, value)),
	};
}
export const lateSaves = storyKit(
	screenKit(
		"late save screen",
		(): State => ({ model: model() }),
		(state, screen) => ({ ...verbs(state, screen), shown: () => Effect.sync(() => shown(state)) }),
	),
);
export function openForm(kind: "editor" | "create") {
	return lateSaves.trait("screen", `a ${kind} whose save waits for a response`, function* ({ state, screen }) {
		state.view = yield* screen.open(createElement(kind === "editor" ? Editor : Create, { state: state.model }));
	});
}
