import { Effect } from "effect";
import { boardStory } from "#test/boardStory.ts";
import type { SocketObservations } from "#test/socketVerbs.ts";

export const observedSockets = boardStory.trait("project", "native client socket requests are observed", function* (engine) {
	const Native = globalThis.WebSocket;
	const observations: SocketObservations = { connections: [], requests: [] };
	engine.sockets = observations;
	globalThis.WebSocket = class extends Native {
		constructor(url: string | URL, protocols?: string | string[]) {
			super(url, protocols);
			observations.connections.push(String(url));
		}
		override send(data: Parameters<WebSocket["send"]>[0]) {
			if (typeof data === "string") {
				for (const line of data.trim().split("\n")) {
					const message = JSON.parse(line);
					if (message._tag === "Request") {
						observations.requests.push(message);
					}
				}
			}
			super.send(data);
		}
	};
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			globalThis.WebSocket = Native;
		}),
	);
});
