import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { budgetHeaders } from "#test/budgetHeaders.ts";
import { graphqlClient } from "#test/graphqlClient.ts";

export function graphqlAnswers(description: string, reply: FakeHttpReply, times = 1) {
	return graphqlClient.trait("github", `GitHub answers GraphQL with ${description}`, function* ({ root }) {
		for (let index = 0; index < times; index += 1) {
			yield* root.server.scriptFault("graphql", { kind: "status", reply });
		}
	});
}

export function graphqlLimited(status: number) {
	return graphqlAnswers(`HTTP ${status} and a GraphQL quota cooldown`, {
		body: { message: "API rate limit exceeded" },
		headers: {
			...budgetHeaders("graphql", { limit: 5000, remaining: status === 403 ? 0 : 40, reset: 3600 }),
			...(status === 429 ? { "retry-after": "60" } : {}),
		},
		status,
	});
}

export const coreLimited = graphqlClient.trait("github", "GitHub refuses the next REST read because its core quota is spent", function* ({ root }) {
	yield* root.server.scriptFault("pull", {
		kind: "status",
		reply: {
			body: { message: "API rate limit exceeded" },
			headers: budgetHeaders("core", { limit: 5000, remaining: 0, reset: 3600 }),
			status: 403,
		},
	});
});
