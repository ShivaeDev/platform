import { Effect } from "effect";
import { act } from "react";
import { type Screen, screenView } from "./screenState.ts";

export function notesRefreshVerbs(engine: Screen, tell: (line: string) => void) {
	return {
		holdNotesList: () =>
			Effect.sync(() => {
				tell("hold the next notes list request");
				engine.client.holdList();
			}),
		loadingMessage: () => screenView(engine).container.querySelector("[role=status]")?.textContent,
		refreshDisabled: () => {
			const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.textContent === "Refresh");
			if (button === undefined) {
				throw new Error("Missing Refresh button");
			}
			return button.disabled;
		},
		releaseNotesList: () =>
			Effect.promise(async () => {
				tell("release the held notes list request");
				await act(async () => engine.client.releaseList());
			}),
	};
}
