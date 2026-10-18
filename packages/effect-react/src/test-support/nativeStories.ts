import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createElement } from "react";
import { expect } from "vitest";
import type { Rendered } from "#testing.ts";
import { NativeNotesView } from "./NativeNotesView.ts";
import { NotesClient } from "./NotesClient.ts";
import { clickButton, screenKit } from "./screenKit.ts";

interface State {
	view?: Rendered;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No notes screen");
	}
	return state.view;
}
export const nativeStory = screenKit(
	"native RPC screen",
	(): State => ({}),
	(state, screen) => ({
		click: (label: string) => screen.act(`click ${label}`, () => clickButton(current(state).container, label)),
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
		settled: (titles: string[], error = false) =>
			screen.observe(`the list shows ${JSON.stringify(titles)}, error ${error}`, () => {
				expect(JSON.parse(current(state).container.querySelector("output")?.textContent ?? "null")).toEqual({
					error,
					loading: false,
					saving: false,
					titles,
				});
			}),
	}),
);
export function nativeNotes() {
	return nativeStory.trait("screen", "an empty SQLite notes repository and its native RPC client", function* ({ screen, state }) {
		state.view = yield* screen.open(createElement(NativeNotesView));
	});
}
