import { Effect } from "effect";
import { expect } from "vitest";
import { GitHubGraphqlError } from "#errors.ts";
import { graphqlClient } from "#test/graphqlClient.ts";
import { graphqlAnswers } from "#test/graphqlTraits.ts";

graphqlClient.it(
	"a batch keeps decoded accessible nodes, null inaccessible nodes and GraphQL errors together",
	[
		graphqlAnswers("one inaccessible user", {
			body: { data: { nodes: [{ login: "widgets-app" }, null] }, errors: [{ message: "Could not resolve user-2" }] },
		}),
	],
	function* ({ askNodes }) {
		expect(yield* askNodes()).toEqual({
			data: { nodes: [{ name: "widgets-app" }, null] },
			errors: [{ message: "Could not resolve user-2" }],
		});
	},
);

for (const body of [
	{ errors: [{ message: "Query unavailable" }, { message: "Try another field" }] },
	{ data: null, errors: [{ message: "Query unavailable" }, { message: "Try another field" }] },
]) {
	graphqlClient.it(
		`GraphQL errors without usable data remain a typed failure: ${JSON.stringify(body)}`,
		[graphqlAnswers("errors without data", { body })],
		function* ({ askNodes }) {
			const error = yield* askNodes().pipe(Effect.flip);

			expect(error).toBeInstanceOf(GitHubGraphqlError);
			expect(error).toMatchObject({
				_tag: "GitHubGraphqlError",
				errors: [{ message: "Query unavailable" }, { message: "Try another field" }],
				message: "Query unavailable; Try another field",
			});
		},
	);
}

graphqlClient.it(
	"partial data still has to match the caller's Schema",
	[graphqlAnswers("an invalid viewer with errors", { body: { data: { viewer: null }, errors: [{ message: "Viewer inaccessible" }] } })],
	function* ({ askViewer }) {
		expect(yield* askViewer()).toBe("Schema mismatch");
	},
);
