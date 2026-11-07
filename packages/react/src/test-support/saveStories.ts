import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Screen } from "#test/Screen.ts";
import { saveSession } from "#test/saveSession.ts";
import { screenKit } from "#test/screenKit.ts";

type SaveKind = "create" | "editor";
interface State {
	view?: Awaited<ReturnType<typeof saveSession>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No save screen is open");
	}
	return state.view;
}
function text(state: State, selector: string) {
	return current(state).container.querySelector(selector)?.textContent ?? "nothing";
}
export const saves = storyKit(
	screenKit(
		"save session screen",
		(): State => ({}),
		(state, screen) => ({
			alert: () => Effect.sync(() => text(state, '[role="alert"]')),
			draft: () => Effect.sync(() => current(state).container.querySelector("input")?.value),
			failure: () => Effect.sync(() => text(state, "[data-failure]")),
			rechecks: () => Effect.sync(() => [...current(state).rechecks]),
			rerender: () => screen.act("the session's screen renders again", () => current(state).render()),
			status: () => Effect.sync(() => text(state, "output")),
			submit: () => screen.driver(current(state).container).click({ name: "Save", role: "button" }),
			type: (value: string) => screen.driver(current(state).container).enter('input[name="name"]', value),
		}),
	),
);

function openSave(kind: SaveKind, dies: boolean) {
	return function* ({ screen, state }: { readonly screen: Screen; readonly state: State }) {
		const view = yield* screen.open();
		state.view = yield* Effect.promise(() => saveSession(view, kind, dies));
	};
}

export function unauthorizedSave(kind: SaveKind) {
	return saves.trait("screen", `a ${kind} form whose saves fail with Unauthorized: Session expired before saving`, openSave(kind, false));
}

export function unauthorizedSaveAnswered(kind: SaveKind) {
	return saves.trait("screen", `a ${kind} form saved Unsaved order, and the save failed with Unauthorized`, function* (engine) {
		yield* openSave(kind, false)(engine);
		const { screen, state } = engine;
		yield* screen.driver(current(state).container).enter('input[name="name"]', "Unsaved order");
		yield* screen.driver(current(state).container).click({ name: "Save", role: "button" });
	});
}

export function dyingSave(kind: SaveKind) {
	return saves.trait("screen", `a ${kind} form whose saves die`, openSave(kind, true));
}
