import { Effect, Schema } from "effect";
import { GitHubConfig } from "#GitHubConfig.ts";
import { decodeGraphqlData, type GraphqlOptions } from "#graphqlRequests.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { write } from "./write.ts";
export function graphql(state: GitHubState) {
	return Effect.fn("GitHub.graphql")(function* (query: string, variables: unknown, options?: GraphqlOptions) {
		const { apiUrl } = yield* GitHubConfig;
		const url = new URL(options?.apiUrl ?? apiUrl);
		url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
		if (!url.pathname.endsWith("/api/graphql")) {
			url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
		}
		const response = yield* write(state)("POST", url.href, { query, variables }, options?.responseByteLimit);
		const body = yield* response.decode(Schema.Unknown);
		return { body, decode: <TSchema extends Schema.Constraint>(schema: TSchema) => decodeGraphqlData(body, schema) };
	});
}
