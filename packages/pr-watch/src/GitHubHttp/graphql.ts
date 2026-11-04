import { Effect } from "effect";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { post } from "#GitHubHttp/post.ts";

export function graphql(state: HttpState) {
	return Effect.fn("GitHubHttp.graphql")((apiUrl: string, query: string, variables: unknown) => {
		const url = new URL(apiUrl);
		url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
		if (!url.pathname.endsWith("/api/graphql")) {
			url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
		}
		return post(state)(url.href, { query, variables });
	});
}
