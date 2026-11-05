import * as NodeWs from "@effect/platform-node/NodeWS";
import { Effect } from "effect";
import * as Socket from "effect/socket/Socket";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostOptions } from "./story.ts";

export const socketBody = storyKit({
	...hostOptions(),
	name: "RPC socket body limit",
	verbs: (state, story) => {
		let connection: { raw: NodeWs.WebSocket; reader: Socket.Reader } | undefined;
		function connected() {
			if (connection === undefined) {
				throw new Error("Open the RPC socket first");
			}
			return connection;
		}
		return {
			...hostOptions().verbs(state, story),
			openSocket: (path = "/rpc") =>
				Effect.gen(function* () {
					story.tell(`a client opens a real WebSocket at ${path}`);
					const raw = yield* Effect.acquireRelease(
						Effect.sync(() => new NodeWs.WebSocket(`${state.url.replace(/^http/u, "ws")}${path}`)),
						(websocket) => Effect.sync(() => websocket.terminate()),
					);
					const socket = yield* Socket.fromWebSocket(Effect.succeed(raw));
					connection = { raw, reader: yield* socket.reader };
				}),
			sendSocketFragments: (fragments: readonly string[]) =>
				Effect.sync(() => {
					story.tell("the client sends one RPC message in continuation frames");
					for (const [index, fragment] of fragments.entries()) {
						connected().raw.send(fragment, { fin: index === fragments.length - 1 });
					}
				}),
			sendSocketMessage: (body: string | Uint8Array) =>
				Effect.sync(() => {
					story.tell(`the client sends a ${typeof body === "string" ? "text" : "binary"} RPC message`);
					connected().raw.send(body);
				}),
			socketAnswer: () =>
				connected().reader.pull.pipe(
					Effect.match({
						onFailure: (error) => ({
							closeReason: error.reason._tag === "SocketCloseError" ? error.reason.closeReason : undefined,
							code: error.reason._tag === "SocketCloseError" ? error.reason.code : undefined,
							connection: "closed",
							error: error._tag,
							reason: error.reason._tag,
						}),
						onSuccess: (frames) => ({
							body: frames.map((frame) => (typeof frame === "string" ? frame : new TextDecoder().decode(frame))).join(""),
							connection: "open",
						}),
					}),
				),
		};
	},
});
