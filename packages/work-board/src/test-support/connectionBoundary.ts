import { createServer, request } from "node:http";
import type { Socket } from "node:net";
import { Effect } from "effect";
import { boardStory } from "./boardStory.ts";
import type { BoardEngine } from "./storyEngine.ts";
import { served } from "./storyEngine.ts";

export function connectionBoundary(browserClient: (url: string) => NonNullable<BoardEngine["server"]>["client"]) {
	return boardStory.trait("reader", "native RPC crosses a connection that can go offline", function* (engine) {
		const { board } = served(engine);
		const connections = new Set<Socket>();
		let offline = false;
		const relay = createServer((incoming, outgoing) => {
			if (offline) {
				incoming.destroy();
				return;
			}
			const upstream = request(new URL(incoming.url ?? "/", board.url), { headers: incoming.headers, method: incoming.method }, (response) => {
				outgoing.writeHead(response.statusCode ?? 500, response.headers);
				response.pipe(outgoing);
			});
			upstream.on("socket", (socket) => {
				connections.add(socket);
				socket.on("close", () => connections.delete(socket));
			});
			upstream.on("error", () => outgoing.destroy());
			outgoing.on("close", () => upstream.destroy());
			incoming.pipe(upstream);
		});
		relay.on("connection", (socket) => {
			connections.add(socket);
			socket.on("close", () => connections.delete(socket));
		});
		function closeRelay() {
			for (const socket of connections) {
				socket.destroy();
			}
			return new Promise<void>((resolve) => relay.close(() => resolve()));
		}
		yield* Effect.acquireRelease(
			Effect.promise(() => new Promise<void>((resolve) => relay.listen(0, "127.0.0.1", resolve))),
			() => Effect.promise(closeRelay),
		);
		const address = relay.address();
		if (!address || typeof address === "string") {
			throw new Error("The RPC relay has no TCP address");
		}
		const client = browserClient(`http://127.0.0.1:${address.port}`);
		yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
		engine.server = { board, client };
		engine.connectionBoundary = {
			disconnect: () => {
				offline = true;
				for (const socket of connections) {
					socket.destroy();
				}
			},
			resume: () => {
				offline = false;
			},
		};
	});
}
