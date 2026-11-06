import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { querySignals } from "@shivaedev/contract/querySignals.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
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
				const { registry } = screenView(engine);
				const signals = querySignals(engine.client.api.list.query());
				const before = registry.get(signals).completed;
				await act(async () => {
					engine.client.releaseList();
					await Effect.runPromise(
						until(AtomRegistry.toStream(registry, signals), ({ completed }) => completed > before, { name: "released notes list" }),
					);
				});
			}),
	};
}
