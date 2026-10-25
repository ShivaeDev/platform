import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { held } from "#test/browser.ts";
import { type BoardEngine, connected, createBoard, inspectBoard, openReader, serveProject } from "#test/storyEngine.ts";

function* openSlowReader(engine: BoardEngine) {
	const request = held();
	engine.heldRequests = new Map([["work-board.document", request]]);
	yield* Effect.forkChild(Effect.sleep("6 seconds").pipe(Effect.ensuring(Effect.sync(request.release))));
	yield* openReader(engine);
}

export const storyEngineStory = storyKit({
	clock: "live",
	create: () => undefined,
	name: "board lifecycle",
	stages: [],
	verbs: () => ({ connected, createBoard, inspectBoard, openReader, openSlowReader, serveProject }),
});
