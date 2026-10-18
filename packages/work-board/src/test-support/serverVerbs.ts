import { renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { browserClient } from "#client/client.ts";
import { folder, type RunningBoard } from "./board.ts";
import { embeddedBoard } from "./embeddedBoard.ts";
import { subscribe } from "./nativeRpc.ts";
import { type SocketExchange, socketExchange } from "./socketRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

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
		moveDirectory: (from: string, to: string) => {
			tell(`an outside process moves ${from} to ${to}`);
			renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
		},
		postToSocket: (exchange: SocketExchange) =>
			Effect.promise(() => {
				tell("a local client posts an RPC batch to the board's socket");
				return socketExchange(join(engine.notes.root, "board.sock"), exchange);
			}),
		removeProject: () => {
			tell("an outside process removes the project root");
			engine.notes.remove();
		},
		restart: Effect.fn("Story.restart")(function* (responses = engine.responses) {
			tell("the board restarts from its project files");
			const page = engine.live?.page;
			if (page) {
				yield* Effect.promise(() => page.close());
			}
			served(engine).client.registry.dispose();
			yield* served(engine).board.stop();
			engine.responses = responses;
			const reopen = engine.live !== undefined;
			delete engine.live;
			const { serveProject, openReader } = yield* Effect.promise(() => import("./storyEngine.ts"));
			yield* serveProject(engine);
			if (reopen) {
				yield* openReader(engine);
			}
			return served(engine);
		}),
		stopBoards: Effect.fn("Story.stopBoards")(function* () {
			tell("all HTTP boards stop before the project is reopened");
			const page = engine.live?.page;
			if (page) {
				yield* Effect.promise(() => page.close());
			}
			yield* served(engine).board.stop();
			for (const board of boards.splice(0)) {
				yield* board.stop();
			}
		}),
		watchProject: () => {
			tell("a live RPC client subscribes to project changes");
			return subscribe(served(engine).board);
		},
	};
}
