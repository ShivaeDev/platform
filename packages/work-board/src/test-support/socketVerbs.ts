import { Clock, Effect } from "effect";
import type { readSnapshot } from "@shivaedev/work-board-plugin/board.ts";
import { bundledClient } from "@shivaedev/work-board-plugin/test-support/bundledClient.ts";
import { type BoardEngine, connected, served } from "#test/storyEngine.ts";
import type { Tally } from "#test/Tally.ts";

type WorkboardBoard = ReturnType<typeof readSnapshot>;

export interface SocketObservations {
	readonly connections: string[];
	plugin?: WorkboardBoard;
	readonly requests: { tag: string; payload: unknown }[];
	readonly snapshots: Tally;
}

function progressOf(snapshot: WorkboardBoard | undefined) {
	if (snapshot?.kind !== "ready") {
		return snapshot?.kind ?? "nothing yet";
	}
	const goal = snapshot.goals.items[0];
	return goal === undefined ? "no goals" : `${goal.done} of ${goal.total} done`;
}

export function socketVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const marks = { progress: "nothing yet", requests: 0, seen: 0 };
	function observations() {
		if (!engine.sockets) {
			throw new Error("Socket observations are not enabled; add observedSockets");
		}
		return engine.sockets;
	}
	function socketName(url: string) {
		return url === `${served(engine).board.url.replace(/^http/u, "ws")}/_board/rpc` ? "the board's RPC socket" : url;
	}
	const nextProgress = Effect.fn("Story.nextProgress")(function* () {
		const sockets = observations();
		for (;;) {
			marks.seen += 1;
			yield* sockets.snapshots.reaches(marks.seen);
			const progress = progressOf(sockets.plugin);
			if (progress !== marks.progress && sockets.plugin?.kind === "ready") {
				marks.progress = progress;
				return progress;
			}
		}
	});
	return {
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
		nextPluginProgress: () => {
			tell("the reader waits for the plugin to show new goal progress");
			return nextProgress();
		},
		openPlugin: () =>
			Effect.acquireRelease(
				Effect.gen(function* () {
					const clock = yield* Clock.Clock;
					const { platformClient } = yield* bundledClient();
					tell("the Claude plugin follows the Board through its shipped socket client");
					const sockets = observations();
					return platformClient(
						served(engine).board.url,
						engine.notes.root,
						() => Promise.resolve(clock.currentTimeMillisUnsafe()),
						(board: WorkboardBoard) => {
							sockets.plugin = board;
							sockets.snapshots.bump();
						},
					);
				}),
				(client) => Effect.sync(client.close),
			),
		pluginReadsSinceMark: () =>
			Effect.sync(() => {
				tell("the reader lists what the plugin asked the board for since the mark");
				return observations()
					.requests.slice(marks.requests)
					.map(({ tag }) => tag)
					.filter((tag) => !tag.endsWith(".$changes"))
					.sort((left, right) => left.localeCompare(right));
			}),
		socketsMarked: () => {
			tell("the reader notes the socket requests sent so far");
			marks.requests = observations().requests.length;
		},
		socketsOpened: () =>
			Effect.sync(() => {
				tell("the reader lists the sockets the page and the node clients opened");
				return {
					"node clients": observations().connections.map(socketName),
					"the page": connected(engine)
						.page.streams.flatMap((stream) => stream.urls())
						.map(socketName),
				};
			}),
	};
}
