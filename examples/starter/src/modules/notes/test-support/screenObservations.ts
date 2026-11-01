import { Effect } from "effect";
import { screenInput } from "#modules/notes/test-support/screenActions.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function screenObservations(engine: ScreenSurface) {
	function container() {
		return screenView(engine).container;
	}
	function rows() {
		return [...container().querySelectorAll('table[aria-label="Saved notes"] tbody tr')];
	}
	return {
		addNoteForm: () => Effect.sync(() => (container().querySelector('section[aria-label="Add a note"] form') === null ? "hidden" : "shown")),
		alert: () => Effect.sync(() => container().querySelector("[role=alert]")?.textContent ?? "no alert"),
		draft: (label?: string) => Effect.sync(() => screenInput(engine, label).value),
		noteLinks: () =>
			Effect.sync(() =>
				rows().map((row) => {
					const link = row.querySelector("a");
					return `${link?.textContent} links to ${link?.getAttribute("href")}`;
				}),
			),
		offers: (label: string) =>
			Effect.sync(() => ([...container().querySelectorAll("button")].some((button) => button.textContent === label) ? "offered" : "not offered")),
		saveState: () => Effect.sync(() => container().querySelector("[aria-live=polite]")?.textContent ?? "no save state"),
		shownNotes: () =>
			Effect.sync(() => {
				const shown: string[] = [];
				if (container().querySelector("[role=status]")?.textContent === "Loading…") {
					shown.push("loading");
				}
				if (container().textContent.includes("No notes yet")) {
					shown.push("no notes yet");
				}
				return [...shown, ...rows().map((row) => row.querySelector("a")?.textContent ?? "untitled row")];
			}),
		wordCounts: () => Effect.sync(() => rows().map((row) => `${row.querySelector("a")?.textContent}: ${row.querySelectorAll("td")[1]?.textContent}`)),
	};
}
