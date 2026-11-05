import { Effect, Schema } from "effect";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { counted } from "#GitHubHttp/counted.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { request } from "#GitHubHttp/request.ts";

export function post(state: HttpState) {
	return Effect.fn("GitHubHttp.post")((url: string, body: unknown) =>
		Effect.flatMap(GitHub, (github) =>
			request(state, counted(state, github.write("POST", url, body)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown)))),
		),
	);
}
