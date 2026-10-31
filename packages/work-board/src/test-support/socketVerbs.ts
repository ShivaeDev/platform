import { join } from "node:path";
import { Clock, Effect } from "effect";
import type { readSnapshot } from "@shivaedev/work-board-plugin/board.ts";
import { rpcPost } from "@shivaedev/work-board-plugin/rpc.ts";
import { bundledClient } from "@shivaedev/work-board-plugin/test-support/bundledClient.ts";
import { socketExchange } from "#test/socketRpc.ts";
import { type BoardEngine, connected, served } from "#test/storyEngine.ts";

type WorkboardBoard = ReturnType<typeof readSnapshot>;

export interface SocketObservations {
	readonly connections: string[];
}

function progressOf(snapshot: WorkboardBoard) {
	if (snapshot.kind !== "ready") {
		return snapshot.kind;
	}
	const goal = snapshot.goals.items[0];
	return goal === undefined ? "no goals" : `${goal.done} of ${goal.total} done`;
}

export function socketVerbs(engine: BoardEngine, tell: (line: string) => void) {
	let plugin: { readonly board: () => Promise<WorkboardBoard> } | undefined;
	function observations() {
		if (!engine.sockets) {
			throw new Error("Socket observations are not enabled; add observedSockets");
		}
		return engine.sockets;
	}
	function socketName(url: string) {
		return url === `${served(engine).board.url.replace(/^http/u, "ws")}/_board/rpc` ? "the board's RPC socket" : url;
	}
	function boardSocket(body: string) {
		return socketExchange(join(engine.notes.root, "board.sock"), rpcPost(engine.notes.root, body)).then((reply) =>
			reply.ok ? reply.text : Promise.reject(new Error(`The board refused the plugin's request (${reply.status})`)),
		);
	}
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
		openPlugin: () =>
			Effect.acquireRelease(
				Effect.gen(function* () {
					const clock = yield* Clock.Clock;
					const { platformClient } = yield* bundledClient();
					tell("the Claude plugin opens its shipped client, which posts each request over board.sock as the host's fetch does");
					const client = platformClient(engine.notes.root, boardSocket, () => Promise.resolve(clock.currentTimeMillisUnsafe()));
					plugin = client;
					return client;
				}),
				(client) => Effect.sync(client.close),
			),
		pluginProgress: () => {
			tell("the plugin reads the board, as its Refresh button and timer do, and shows its goal progress");
			const client = plugin;
			if (client === undefined) {
				return Effect.die(new Error("The plugin is not open; call openPlugin first"));
			}
			return Effect.map(
				Effect.promise(() => client.board()),
				progressOf,
			);
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
