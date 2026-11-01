import { Effect } from "effect";
import { act } from "react";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function notesUiVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	function titleHeader() {
		const header = screenView(engine).container.querySelector('table[aria-label="Saved notes"] th');
		if (header === null) {
			throw new Error("Missing notes table");
		}
		return header;
	}
	return {
		codeLines: () =>
			Effect.sync(() =>
				[...screenView(engine).container.querySelectorAll("pre code > span")].map(
					(line) => `${line.getAttribute("data-line-kind")}: ${line.textContent}`,
				),
			),
		sortsByTitle: () =>
			Effect.promise(async () => {
				tell("sort the notes by title");
				const button = titleHeader().querySelector("button");
				await act(async () => button?.click());
			}),
		titleSort: () => Effect.sync(() => titleHeader().getAttribute("aria-sort") ?? "unsorted"),
	};
}
