import { Effect } from "effect";
import { act } from "react";
import { expect } from "vitest";
import { observeScreen } from "./screenObservations.ts";
import { type Screen, screenView } from "./screenState.ts";

export function notesRefreshVerbs(engine: Screen, tell: (line: string) => void) {
	const observe = observeScreen(tell);
	function refreshIsDisabled(disabled: boolean) {
		return observe(`the notes list request is ${disabled ? "pending" : "complete"} and Refresh is ${disabled ? "disabled" : "enabled"}`, () => {
			const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.textContent === "Refresh");
			expect(button?.disabled).toBe(disabled);
		});
	}
	return {
		holdNotesList: () =>
			Effect.sync(() => {
				tell("hold the next notes list request");
				engine.client.holdList();
			}),
		notesListIsPending: () => refreshIsDisabled(true),
		notesListIsReady: () => refreshIsDisabled(false),
		notesLoadingIs: (visible: boolean) =>
			observe(`the initial notes loading message is ${visible ? "visible" : "absent"}`, () => {
				expect(screenView(engine).container.querySelector("[role=status]")?.textContent).toBe(visible ? "Loading notes…" : undefined);
			}),
		releaseNotesList: () =>
			Effect.promise(async () => {
				tell("release the held notes list request");
				await act(() => engine.client.releaseList());
			}),
	};
}
