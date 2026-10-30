import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Queue } from "effect";
import * as Socket from "effect/socket/Socket";

export const proxyTransport = Effect.gen(function* () {
	const opened = yield* Queue.unbounded<void>();
	const closed = yield* Queue.unbounded<void>();
	const sent = yield* Queue.unbounded<void>();
	const buffered = yield* Queue.unbounded<void>();
	const addresses: string[] = [];
	const frames: (() => void)[] = [];
	let gateFrames = false;
	const webSocketConstructor = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (url, options) => {
			addresses.push(url);
			const socket = make(url, options);
			socket.addEventListener("open", () => Queue.offerUnsafe(opened, undefined));
			socket.addEventListener("close", () => Queue.offerUnsafe(closed, undefined));
			const send = socket.send.bind(socket);
			socket.send = (data) => {
				if (gateFrames) {
					frames.push(() => send(data));
					Queue.offerUnsafe(buffered, undefined);
				} else {
					send(data);
					Queue.offerUnsafe(sent, undefined);
				}
			};
			return socket;
		}),
	).pipe(Layer.provide(layerWebSocketConstructorWS));
	return {
		addresses: () => [...addresses],
		buffered: Queue.take(buffered),
		closed: Queue.take(closed),
		gateFrames: () => {
			gateFrames = true;
		},
		opened: Queue.take(opened),
		releaseFrames: () => {
			gateFrames = false;
			for (const send of frames.splice(0)) {
				send();
			}
		},
		sent,
		webSocketConstructor,
	};
});
