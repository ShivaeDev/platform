import { Effect } from "effect";
import { act } from "react";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { acquireScreen, screenView } from "#test-support/screenState.ts";
import { DeleteControl } from "./DeleteControl.tsx";
import type { Screen } from "./screenState.ts";

export const deleteControls = Effect.fnUntraced(function* (engine: Screen) {
	const view = yield* acquireScreen(engine);
	const notes = yield* Effect.promise(() => loadQuery(view.registry, engine.client.api.list.query(), { abortController: new AbortController() }));
	yield* Effect.promise(() => view.render(notes.map((note) => <DeleteControl client={engine.client} key={note.id} note={note} />)));
});

export function deleteControlVerbs(engine: Screen, tell: (line: string) => void) {
	function control(title: string) {
		const section = [...screenView(engine).container.querySelectorAll("section")].find((element) => element.getAttribute("aria-label") === title);
		const button = section?.querySelector("button");
		if (section === undefined || button === undefined || button === null) {
			throw new Error(`Missing delete control for ${title}`);
		}
		return { button, section };
	}
	return {
		deleteNote: (title: string) =>
			Effect.promise(async () => {
				tell(`delete ${title}`);
				const { button } = control(title);
				if (button.disabled) {
					throw new Error(`Cannot delete ${title} while its control is disabled`);
				}
				await act(async () => button.click());
			}),
		deleteState: (title: string) =>
			Effect.sync(() => {
				const { button, section } = control(title);
				return { button: `${button.textContent}, ${button.disabled ? "disabled" : "enabled"}`, completion: section.querySelector("p")?.textContent };
			}),
	};
}
