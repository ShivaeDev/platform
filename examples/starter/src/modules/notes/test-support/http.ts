import { HttpClient, HttpClientRequest } from "effect/http";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "#modules/notes/notes.ts";

export function notesHttp(baseUrl: string, cookie = "", origin = baseUrl) {
	return makeClient(Notes, {
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin })),
		url: `${baseUrl}/rpc`,
	}).client;
}
