import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { NativeNotesView } from "./NativeNotesView.ts";
import { NotesClient } from "./NotesClient.ts";
import { clickButton, type Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

interface State {
	view?: Rendered;
}

interface Shown {
	readonly error: boolean;
	readonly loading: boolean;
	readonly saving: boolean;
	readonly titles: readonly string[];
}

function current(state: State) {
	if (!state.view) {
		throw new Error("No notes screen");
	}
	return state.view;
}

function shown(state: State): Shown {
	const output = current(state).container.querySelector("output");
	if (output === null) {
		throw new Error("The notes screen shows no state");
	}
	return JSON.parse(output.textContent ?? "");
}

function settle(state: State, screen: Screen) {
	return settleScreen(
		current(state).container,
		() => {
			const { loading, saving } = shown(state);
			return loading || saving;
		},
		screen.tell,
	);
}

function click(state: State, screen: Screen, label: string) {
	return screen.act(`click ${label}`, () => clickButton(current(state).container, label)).pipe(Effect.andThen(settle(state, screen)));
}

export const nativeStory = storyKit(
	screenKit(
		"native RPC notes screen",
		(): State => ({}),
		(state, screen) => ({
			click: (label: "Save" | "Save empty") => click(state, screen, label),
			listedTitles: () => Effect.sync(() => shown(state).titles),
			saveError: () => Effect.sync(() => (shown(state).error ? "shown" : "none")),
			storedNotes: () => {
				screen.tell("read the stored notes through the native RPC client");
				const read = NotesClient.runtime.atom(
					Effect.gen(function* () {
						const client = yield* NotesClient;
						return yield* client("ListNotes", undefined);
					}),
				);
				return AtomRegistry.getResult(current(state).registry, read).pipe(Effect.map((rows) => rows.map(({ id, title }) => ({ id, title }))));
			},
		}),
	),
);

function* openNotes({ screen, state }: { readonly screen: Screen; readonly state: State }) {
	state.view = yield* screen.open(createElement(NativeNotesView));
	yield* settle(state, screen);
}

export function emptyNotesShown() {
	return nativeStory.trait("screen", "the notes screen lists an empty SQLite notes repository through its native RPC client", openNotes);
}

export function morningWalkSaved() {
	return nativeStory.trait("screen", "the notes screen saved and lists Morning walk", function* (engine) {
		yield* openNotes(engine);
		yield* click(engine.state, engine.screen, "Save");
	});
}
