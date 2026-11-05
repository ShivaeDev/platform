import { Effect } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { counted } from "#github-http/counted.ts";
import type { HttpState } from "#github-http/initialize.ts";
import { request } from "#github-http/request.ts";

export function graphql(state: HttpState) {
	return Effect.fn("GitHubHttp.graphql")((apiUrl: string, query: string, variables: unknown) =>
		Effect.gen(function* () {
			const github = yield* GitHub;
			return yield* request(state, counted(state, github.graphql(query, variables, { apiUrl })).pipe(Effect.map((response) => response.body)));
		}),
	);
}
