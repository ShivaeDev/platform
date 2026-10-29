import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "#modules/notes/notes.ts";

export function notesHttp(baseUrl: string, cookie = "", origin = baseUrl) {
	return makeClient(Notes, {
		headers: { cookie, origin },
		url: `${baseUrl}/rpc`,
		webSocketConstructor: layerWebSocketConstructorWS,
	}).client;
}
