import { Effect } from "effect";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { renderBoard } from "./react.tsx";
import { SearchHarness } from "./SearchHarness.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenClient } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenStory } from "./screenStory.ts";
import { screenFiles } from "./screenWorkspaceTraits.ts";
export function searchScreen(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	return screenStory.traits(
		screenFiles(files, options),
		screenStory.trait("screen", "the reader opens Search", function* (engine) {
			const view = yield* Effect.promise(() =>
				renderBoard(
					engine.files,
					(api) => {
						screenClient(engine, api);
						return <SearchHarness api={api} />;
					},
					screenOptions(engine, engine.options),
				),
			);
			trackScreen(engine, view, (line) => engine.tell?.(line));
		}),
	);
}
