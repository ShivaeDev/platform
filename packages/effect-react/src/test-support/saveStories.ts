import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { saveSession } from "./saveSession.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	view?: Awaited<ReturnType<typeof saveSession>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No save session screen");
	}
	return state.view;
}
export const saves = storyKit(
	screenKit(
		"save session screen",
		(): State => ({}),
		(state, screen) => ({
			rerender: () => screen.act("rerender the same session", () => current(state).render()),
			save: () => current(state),
			submit: () => screen.act("submit the save", () => clickButton(current(state).container, "Save")),
			type: (value: string) => screen.act(`type name: ${value}`, () => typeInput(current(state).container, "name", value)),
		}),
	),
);
export function saveProbe(kind: "create" | "editor") {
	return saves.trait("screen", `an Unauthorized ${kind} save`, function* ({ screen, state }) {
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() => saveSession(view, kind));
	});
}
