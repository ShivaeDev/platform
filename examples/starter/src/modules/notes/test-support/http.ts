import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";

export function notesHttp(baseUrl: string, cookie = "", origin = baseUrl) {
	return makeClient(Notes, {
		headers: { cookie, origin },
		url: `${baseUrl}/rpc`,
		webSocketConstructor: layerWebSocketConstructor,
	}).client;
}
