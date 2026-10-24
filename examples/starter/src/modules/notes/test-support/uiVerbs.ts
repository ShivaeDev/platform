import { Effect } from "effect";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function notesUiVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	return {
		codePreview: () =>
			Effect.sync(() => {
				tell("read the rendered code preview");
				const preview = screenView(engine).container.querySelector("pre");
				if (preview === null) {
					throw new Error("Missing code preview");
				}
				return preview;
			}),
		notesTable: () =>
			Effect.sync(() => {
				tell("read the rendered notes table");
				const table = screenView(engine).container.querySelector("table");
				if (table === null) {
					throw new Error("Missing notes table");
				}
				return table;
			}),
	};
}
