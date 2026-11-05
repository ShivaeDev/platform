import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer } from "effect";
import * as Socket from "effect/socket/Socket";

export function readPageTransport() {
	const addresses: string[] = [];
	const sockets: Socket.WebSocketLike[] = [];
	const webSocketConstructor = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
			addresses.push(address);
			const socket = make(address, options);
			sockets.push(socket);
			return socket;
		}),
	).pipe(Layer.provide(layerWebSocketConstructor));
	return {
		addresses: () => [...addresses],
		disconnect: () => {
			const socket = sockets[0];
			if (socket === undefined) {
				throw new Error("The page has no open socket");
			}
			socket.close();
		},
		webSocketConstructor,
	};
}
