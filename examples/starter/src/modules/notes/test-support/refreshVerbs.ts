import { Effect } from "effect";
import { act } from "react";
import { screenView } from "#test-support/screenState.ts";
import type { Screen } from "./screenState.ts";

export function notesRefreshVerbs(engine: Screen, tell: (line: string) => void) {
	return {
		holdNotesList: () =>
			Effect.sync(() => {
				tell("hold the next notes list request");
				engine.client.holdList();
			}),
		refreshButton: () =>
			Effect.sync(() => {
				const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.textContent === "Refresh");
				if (button === undefined) {
					return "missing";
				}
				return button.disabled ? "disabled" : "enabled";
			}),
		releaseNotesList: () =>
			Effect.promise(async () => {
				tell("release the held notes list request");
				await act(async () => engine.client.releaseList());
			}),
	};
}
