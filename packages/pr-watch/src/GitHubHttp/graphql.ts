import { Effect } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { counted } from "#GitHubHttp/counted.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { request } from "#GitHubHttp/request.ts";

export function graphql(state: HttpState) {
	return Effect.fn("GitHubHttp.graphql")((apiUrl: string, query: string, variables: unknown) =>
		Effect.flatMap(GitHub, (github) =>
			request(state, counted(state, github.graphql(query, variables, { apiUrl })).pipe(Effect.map((response) => response.body))),
		),
	);
}
