import { createMemoryHistory, RouterContextProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { boardRouter } from "#client/react/boardRouter.ts";
import { MainLocationContext } from "#client/react/MainLocationContext.ts";
import { emptyMainLocation } from "#client/react/mainLocation.ts";
import { documentData } from "./documentRendering.ts";
import { ReadingReadyHarness } from "./ReadingReadyHarness.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

export function readingReadyScreen() {
	return screenStory.trait("screen", "the document waits to report its reading readiness", function* (engine) {
		const data = documentData("# Plan\n\n## Evidence\n\nRead this passage.");
		const route = "/nested/reading.md";
		const router = boardRouter(undefined, createMemoryHistory({ initialEntries: [`${route}#heading-evidence`] }));
		engine.router = router;
		const view = yield* Effect.promise(() =>
			renderBoard({}, (api, registry) => (
				<RouterContextProvider router={router}>
					<MainLocationContext.Provider value={{ ...emptyMainLocation, file: data.file, route }}>
						<ReadingReadyHarness document={data} shell={{ api, registry }} />
					</MainLocationContext.Provider>
				</RouterContextProvider>
			)),
		);
		trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
