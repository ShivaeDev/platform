import { Clock, Effect } from "effect";
import type { readSnapshot } from "@shivaedev/work-board-plugin/board.ts";
import { bundledClient } from "@shivaedev/work-board-plugin/test-support/bundledClient.ts";
import { type BoardEngine, connected, served } from "#test/storyEngine.ts";

type WorkboardBoard = ReturnType<typeof readSnapshot>;

export interface SocketObservations {
	readonly connections: string[];
	plugin?: WorkboardBoard;
	readonly requests: { tag: string; payload: unknown }[];
}

export function socketVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function observePlugin(board: WorkboardBoard) {
		if (!engine.sockets) {
			throw new Error("Socket observations are not enabled");
		}
		engine.sockets.plugin = board;
	}
	return {
		browserReadCounts: () =>
			Object.fromEntries([...Map.groupBy(connected(engine).page.pageRequests.calls, ({ tag }) => tag)].map(([tag, calls]) => [tag, calls.length])),
		browserSocketConnections: () => connected(engine).page.streams.flatMap((stream) => stream.urls()),
		followDocument: (url: string) =>
			Effect.gen(function* () {
				tell(`a reader follows ${url} in the same client`);
				const client = served(engine).client;
				const query = client.api.document.query({ url });
				yield* Effect.acquireRelease(
					Effect.sync(() => client.registry.mount(query)),
					(release) => Effect.sync(release),
				);
				yield* Effect.promise(() => client.read(query));
			}),
		openPlugin: () =>
			Effect.acquireRelease(
				Effect.gen(function* () {
					const clock = yield* Clock.Clock;
					const { platformClient } = yield* bundledClient();
					tell("the Claude plugin follows the Board through its shipped socket client");
					return platformClient(served(engine).board.url, engine.notes.root, () => Promise.resolve(clock.currentTimeMillisUnsafe()), observePlugin);
				}),
				(client) => Effect.sync(client.close),
			),
		pluginSnapshot: () => engine.sockets?.plugin,
		socketConnections: () => [...(engine.sockets?.connections ?? [])],
		socketRequests: () => [...(engine.sockets?.requests ?? [])],
	};
}
