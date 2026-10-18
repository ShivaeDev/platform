import { join } from "node:path";
import { Effect } from "effect";
import { browserClient } from "#client/client.ts";
import { folder, type RunningBoard } from "./board.ts";
import { embeddedBoard } from "./embeddedBoard.ts";
import { type SocketExchange, socketExchange } from "./socketRpc.ts";
import { type BoardEngine, connected } from "./storyEngine.ts";

export function serverVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const boards: RunningBoard[] = [];
	return {
		anotherFolder: (files: Readonly<Record<string, string>>) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					tell("an outside folder exists beyond the board");
					return folder(files);
				}),
				(notes) => Effect.sync(notes.remove),
			),
		connectBoard: Effect.fn("Story.connectBoard")(function* () {
			tell("another real HTTP board serves the same project");
			const board = yield* embeddedBoard(engine.notes.root, true);
			boards.push(board);
			return yield* Effect.acquireRelease(
				Effect.sync(() => browserClient(board.url)),
				(client) => Effect.sync(() => client.registry.dispose()),
			);
		}),
		postToSocket: (exchange: SocketExchange) =>
			Effect.promise(() => {
				tell("a local client posts an RPC batch to the board's socket");
				return socketExchange(join(engine.notes.root, "board.sock"), exchange);
			}),
		restart: Effect.fn("Story.restart")(function* (responses = engine.responses) {
			tell("the board restarts from its project files");
			yield* Effect.promise(() => connected(engine).page.close());
			connected(engine).client.registry.dispose();
			yield* connected(engine).board.stop();
			engine.responses = responses;
			const { serveProject } = yield* Effect.promise(() => import("./storyEngine.ts"));
			yield* serveProject(engine);
			return connected(engine);
		}),
		stopBoards: Effect.fn("Story.stopBoards")(function* () {
			tell("all HTTP boards stop before the project is reopened");
			yield* Effect.promise(() => connected(engine).page.close());
			yield* connected(engine).board.stop();
			for (const board of boards.splice(0)) {
				yield* board.stop();
			}
		}),
	};
}
