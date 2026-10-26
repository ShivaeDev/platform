import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { NativeNotesView } from "./NativeNotesView.ts";
import { NotesClient } from "./NotesClient.ts";
import { clickButton } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No notes screen");
	}
	return state.view;
}
export const nativeStory = storyKit(
	screenKit(
		"native RPC screen",
		(): State => ({}),
		(state, screen) => ({
			click: (label: string) => screen.act(`click ${label}`, () => clickButton(current(state).container, label)),
			notes: () => current(state).container,
			persisted: () => {
				screen.tell("read persisted notes through the native RPC client");
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
export function nativeNotes() {
	return nativeStory.trait("screen", "an empty SQLite notes repository and its native RPC client", function* ({ screen, state }) {
		state.view = yield* screen.open(createElement(NativeNotesView));
	});
}
