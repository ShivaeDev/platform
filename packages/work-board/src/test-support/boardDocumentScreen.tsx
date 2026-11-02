import { Effect } from "effect";
import { ProjectionMain } from "#client/react/ProjectionMain.tsx";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenClient, screenContent } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenSettles } from "./screenSettle.ts";
import { screenStory } from "./screenStory.ts";

export function boardDocumentScreen(files: Record<string, string>, url: string, options?: BoardFixtureOptions) {
	return screenStory.trait("screen", `the reader opens the board document ${url}`, function* (engine) {
		engine.files = { ...files };
		engine.options = options;
		engine.boardScreen = trackScreen(
			engine,
			yield* Effect.promise(() =>
				renderBoard(
					engine.files,
					(api) => {
						screenClient(engine, api);
						return screenContent(engine, <ProjectionMain api={api} onPage={() => undefined} route="board" url={url} />);
					},
					screenOptions(engine, options),
				),
			),
			(line) => engine.tell?.(line),
		);
		yield* screenSettles(engine);
	});
}
