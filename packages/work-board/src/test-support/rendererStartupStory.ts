import "#test/adapters/renderFaults.ts";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { refuseRenderers } from "#test/adapters/renderFaults.ts";
import { type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { driveWatchTimers } from "#test/driveWatchTimers.ts";
import { embeddedBoard } from "#test/embeddedBoard.ts";
import { type BoardEngine, createBoard } from "#test/storyEngine.ts";

interface StartupEngine extends BoardEngine {
	readonly constructions: () => number;
	host?: RunningBoard;
}

export const rendererStartupStory = storyKit({
	around: driveWatchTimers,
	clock: "test",
	*create() {
		const engine = yield* createBoard();
		engine.notes.write("index.md", "# Reading\n\n```ts\nconst answer = 42\n```");
		const startup: StartupEngine = { ...engine, constructions: refuseRenderers() };
		return startup;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	name: "renderer-free startup",
	stages: [],
	verbs: (engine, story) => ({
		homeResponse: () => {
			story.tell("a reader requests the home page over HTTP");
			if (!engine.host) {
				throw new Error("The server has not started");
			}
			return rawGet(engine.host, "/");
		},
		rendererConstructions: () => {
			story.tell("the host reads the number of server renderer constructions");
			return Effect.sync(engine.constructions);
		},
		serverStarts: (embedded: boolean) => {
			story.tell(`the ${embedded ? "embedded" : "production"} Board server starts with renderer construction unavailable`);
			return (embedded ? embeddedBoard(engine.notes.root) : startBoard(engine.notes.root)).pipe(
				Effect.tap((host) =>
					Effect.sync(() => {
						engine.host = host;
					}),
				),
				Effect.asVoid,
			);
		},
	}),
});
