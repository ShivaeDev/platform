import { Effect, Schema } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { counted } from "#GitHubHttp/counted.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { request } from "#GitHubHttp/request.ts";

export function get(state: HttpState) {
	return Effect.fn("GitHubHttp.get")((url: string) =>
		Effect.flatMap(GitHub, (github) =>
			request(state, counted(state, github.read(url)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown)))),
		),
	);
}
