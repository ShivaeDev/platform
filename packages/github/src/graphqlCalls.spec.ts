import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { graphqlClient } from "#test/graphqlClient.ts";
import { coreLimited, graphqlAnswers, graphqlLimited } from "#test/graphqlTraits.ts";

for (const base of ["", "/", "/api/v3", "/api/v3/"] as const) {
	graphqlClient.it(
		`the ${base || "origin"} client sends an authenticated GraphQL query to its GraphQL endpoint`,
		[],
		function* ({ askViewer, requests }) {
			yield* askViewer(base);

			expect(yield* requests(base)).toEqual([
				{
					apiVersion: "2022-11-28",
					body: { query: "query Viewer { viewer { login } }", variables: { includePrivate: false } },
					credential: "installation token 1",
					method: "POST",
					path: base.startsWith("/api/v3") ? "/api/graphql" : "/graphql",
					status: 200,
				},
			]);
		},
	);
}

graphqlClient.it("a clean query returns Schema-decoded data and no errors", [], function* ({ askViewer }) {
	expect(yield* askViewer()).toEqual({ data: { viewer: { name: "widgets-app" } }, errors: [] });
});

graphqlClient.it("the data Schema uses the caller's decoding service", [], function* ({ askViewerWithPrefix }) {
	expect(yield* askViewerWithPrefix("Signed in: ")).toEqual({ data: "Signed in: widgets-app", errors: [] });
});

for (const body of [{ data: { viewer: { login: 1 } } }, {}, { errors: "unavailable" }]) {
	graphqlClient.it(
		`the query rejects a malformed response ${JSON.stringify(body)}`,
		[graphqlAnswers("invalid data", { body })],
		function* ({ askViewer }) {
			expect(yield* askViewer()).toBe("Schema mismatch");
		},
	);
}

graphqlClient.it(
	"an empty errors array still allows Schema-decoded data",
	[graphqlAnswers("data and no errors", { body: { data: { viewer: { login: "widgets-app" } }, errors: [] } })],
	function* ({ askViewer }) {
		expect(yield* askViewer()).toEqual({ data: { viewer: { name: "widgets-app" } }, errors: [] });
	},
);

graphqlClient.it("a query respects the per-request body cap", [], function* ({ askViewer }) {
	expect(yield* askViewer("", 10)).toBe("body over 10 bytes");
});

graphqlClient.it("an HTTP refusal remains a typed HTTP failure", [graphqlAnswers("HTTP 503", { status: 503 })], function* ({ askViewer }) {
	expect(yield* askViewer()).toBe("HTTP 503");
});

for (const status of [403, 429]) {
	graphqlClient.it(
		`HTTP ${status} refuses a second GraphQL query locally during its cooldown`,
		[graphqlLimited(status)],
		function* ({ askViewer, requests }) {
			yield* askViewer();

			const answer = yield* askViewer();

			yield* outcomes([
				["second query", () => Effect.succeed(answer), `rate limited on graphql until ${status === 403 ? "01:00:00" : "00:01:00"}`],
				["sent queries", () => requests(), [{ status }]],
			]);
		},
	);
}

graphqlClient.it("a core REST quota refusal leaves the first GraphQL query available", [coreLimited], function* ({ askViewer, readPull }) {
	yield* readPull();

	expect(yield* askViewer()).toEqual({ data: { viewer: { name: "widgets-app" } }, errors: [] });
});

graphqlClient.it("a GraphQL quota refusal leaves REST core requests available", [graphqlLimited(403)], function* ({ askViewer, readPull }) {
	yield* askViewer();

	expect(yield* readPull()).toEqual({ number: 1 });
});

graphqlClient.it(
	"GraphQL response headers become quota observations",
	[
		graphqlAnswers("a GraphQL budget", {
			body: { data: { viewer: { login: "widgets-app" } } },
			headers: {
				"x-ratelimit-limit": "5000",
				"x-ratelimit-remaining": "4998",
				"x-ratelimit-reset": "3600",
				"x-ratelimit-resource": "graphql",
				"x-ratelimit-used": "2",
			},
		}),
	],
	function* ({ askViewer, budgets }) {
		yield* askViewer();

		expect(yield* budgets()).toMatchObject([{ limit: 5000, remaining: 4998, resource: "graphql", used: 2 }]);
	},
);

for (const times of [1, 2]) {
	graphqlClient.it(
		`a query rejected ${times} times refreshes its installation token once`,
		[graphqlAnswers(`${times} unauthorized responses`, { body: { message: "Bad credentials" }, status: 401 }, times)],
		function* ({ askViewer, requests }) {
			const result = yield* askViewer();

			yield* outcomes([
				["query result", () => Effect.succeed(result), times === 1 ? { data: { viewer: { name: "widgets-app" } }, errors: [] } : "unauthorized"],
				[
					"sent queries",
					() => requests(),
					[
						{ credential: "installation token 1", status: 401 },
						{ credential: "installation token 2", status: times === 1 ? 200 : 401 },
					],
				],
			]);
		},
	);
}
