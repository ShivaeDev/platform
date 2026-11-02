import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect, Layer, Predicate } from "effect";
import { RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";

function observeRequests(outgoing: RpcSerialization.Parser, requests: string[], data: string | Uint8Array) {
	const messages = outgoing.decode(data);
	for (const message of messages) {
		if (Predicate.isTagged(message, "Request") && "tag" in message) {
			requests.push(String(message.tag));
		}
	}
	return messages.some((message) => Predicate.isTagged(message, "Ack"));
}

function observeResults(incoming: RpcSerialization.Parser, results: unknown[], data: unknown) {
	if (typeof data !== "string" && !(data instanceof Uint8Array)) {
		throw new Error("Expected an NDJSON socket frame");
	}
	for (const message of incoming.decode(data)) {
		if (Predicate.isTagged(message, "Chunk") && "values" in message && Array.isArray(message.values)) {
			results.push(...message.values);
		}
	}
}

export function transport() {
	let stalled = false;
	const held: (() => void)[] = [];
	const requests: string[] = [];
	const results: unknown[] = [];
	const acknowledgementHeld = Deferred.makeUnsafe<void>();
	let sockets = 0;
	const layer = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
			const socket = make(address, options);
			sockets += 1;
			const outgoing = RpcSerialization.ndjson.makeUnsafe();
			const incoming = RpcSerialization.ndjson.makeUnsafe();
			const send = socket.send.bind(socket);
			socket.send = (data) => {
				const acknowledgement = observeRequests(outgoing, requests, data);
				if (stalled && acknowledgement) {
					held.push(() => send(data));
					Deferred.doneUnsafe(acknowledgementHeld, Effect.void);
				} else {
					send(data);
				}
			};
			socket.addEventListener("message", (event) => observeResults(incoming, results, event.data));
			return socket;
		}),
	).pipe(Layer.provide(layerWebSocketConstructorWS));
	return {
		acknowledgementHeld,
		layer,
		requests,
		results,
		resume: () => {
			stalled = false;
			for (const send of held.splice(0)) {
				send();
			}
		},
		sockets: () => sockets,
		stall: () => {
			stalled = true;
		},
	};
}
