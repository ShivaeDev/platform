import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type ScreenSurface, screenView } from "./screenState.ts";

export function uiScreenVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	const driver = screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending: () => false,
		root: () => screenView(engine).container,
		tell,
	});
	return {
		accessible: driver.accessible,
		clickControl: driver.click,
		codePreview: () =>
			Effect.sync(() => {
				tell("read the rendered code preview");
				const preview = screenView(engine).container.querySelector("pre");
				if (preview === null) {
					throw new Error("Missing code preview");
				}
				return preview;
			}),
		controlText: driver.text,
		notesTable: () =>
			Effect.sync(() => {
				tell("read the rendered notes table");
				const table = screenView(engine).container.querySelector("table");
				if (table === null) {
					throw new Error("Missing notes table");
				}
				return table;
			}),
		screenContent: () =>
			Effect.sync(() => {
				tell("read the rendered screen");
				return screenView(engine).container;
			}),
	};
}
