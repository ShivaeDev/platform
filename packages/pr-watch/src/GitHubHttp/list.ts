import { Effect, Schema, Stream } from "effect";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { beforeRequest } from "#GitHubHttp/beforeRequest.ts";
import { counted } from "#GitHubHttp/counted.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { request } from "#GitHubHttp/request.ts";

export function list(state: HttpState) {
	return Effect.fn("GitHubHttp.list")((url: string) =>
		Effect.flatMap(GitHub, (github) =>
			request(
				state,
				Stream.unwrap(github.list(url, () => beforeRequest(state).pipe(Effect.provideService(GitHub, github)))).pipe(
					Stream.mapEffect((response) => counted(state, response.decode(Schema.Unknown))),
					Stream.runCollect,
				),
			),
		),
	);
}
