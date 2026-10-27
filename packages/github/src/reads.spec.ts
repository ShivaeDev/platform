import { Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { RemoteNotFound, ResponseBodyTooLarge } from "@shivaedev/http/errors.ts";
import { GitHubPermissionDenied } from "#errors.ts";
import { FIXTURE_TOKEN } from "#test/fixtures.ts";
import { github } from "#test/github.ts";
import { coreNearlySpent, currentEtag, repositoryListsPullRequests, routeAnswers } from "#test/traits.ts";

github.it("decodes a read and sends GitHub's version, media type and bearer token", [], function* ({ readPull, requests }) {
	expect(yield* readPull()).toEqual({ number: 1, title: "Pull request 1" });
	expect(requests()[0]?.headers).toMatchObject({
		accept: "application/vnd.github+json",
		authorization: `Bearer ${FIXTURE_TOKEN}`,
		"x-github-api-version": "2022-11-28",
	});
});

github.it(
	"fails typed on a missing resource without retaining the query",
	[routeAnswers({ status: HttpStatus.fromLiteral("NotFound") })],
	function* ({ readPull }) {
		const error = yield* Effect.flip(readPull());
		expect(error).toBeInstanceOf(RemoteNotFound);
		expect(JSON.stringify(error)).not.toContain("query-secret");
	},
);

github.it("fails typed when GitHub's JSON breaks the requested Schema", [routeAnswers({ body: { number: "one" } })], function* ({ readPull }) {
	expect(yield* Effect.flip(readPull())).toBeInstanceOf(Schema.SchemaError);
});

github.it(
	"a permission refusal ignores rate-limit text outside the message and excludes the query",
	[
		routeAnswers({
			body: { "documentation_url": "/rate limit", message: "Resource not accessible by integration" },
			status: HttpStatus.fromLiteral("Forbidden"),
		}),
	],
	function* ({ readPull }) {
		expect(yield* Effect.flip(readPull())).toEqual(new GitHubPermissionDenied({ path: "/repos/acme/widgets/pulls/1" }));
	},
);

github.it("bounds JSON before Schema decoding", [routeAnswers({ chunks: ["x".repeat(1024 * 1024 + 1)] })], function* ({ readPull }) {
	expect(yield* Effect.flip(readPull())).toEqual(new ResponseBodyTooLarge({ limit: 1024 * 1024 }));
});

github.it("revalidates an unchanged read and returns the same decoded value", [currentEtag], function* ({ readPull, requests }) {
	const first = yield* readPull();
	const second = yield* readPull();
	expect(second).toBe(first);
	expect(requests().map(({ headers }) => headers["if-none-match"])).toEqual([undefined, '"current"']);
});

github.it("decodes a cached representation independently for each caller Schema", [currentEtag], function* ({ readPull, readPullAs }) {
	yield* readPull();
	expect(yield* Effect.flip(readPullAs(Schema.Struct({ number: Schema.String })))).toBeInstanceOf(Schema.SchemaError);
});

github.it("lists every pull request across three Link pages", [repositoryListsPullRequests(5)], function* ({ readPulls, requests }) {
	expect((yield* readPulls()).map(({ number }) => number)).toEqual([1, 2, 3, 4, 5]);
	expect(requests().map(({ query }) => query.get("page"))).toEqual([null, "2", "3"]);
});

github.it("taking only the first pull request sends one request", [repositoryListsPullRequests(5)], function* ({ readPulls, requests }) {
	expect(yield* readPulls(1)).toEqual([{ number: 1, title: "Pull request 1" }]);
	expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls"]);
});

github.it("bounds a chunked artifact body", [], function* ({ bytes }) {
	expect(yield* Effect.flip(bytes(5))).toEqual(new ResponseBodyTooLarge({ limit: 5 }));
});

github.it("reads diff text and artifact bytes with the caller's media type", [], function* ({ text, bytes, requests }) {
	expect(yield* text(11)).toBe("patch bytes");
	expect(yield* bytes(11)).toEqual(new TextEncoder().encode("patch bytes"));
	expect(requests().map(({ headers }) => headers.accept)).toEqual(["application/vnd.github.diff", "application/octet-stream"]);
});

for (const method of ["POST", "PATCH"] as const) {
	github.it(`${method} sends JSON and decodes the response`, [], function* ({ writeIssue, requests }) {
		expect(yield* writeIssue(method)).toEqual({ number: 1, title: "Pull request 1" });
		expect(requests()[0]?.method).toBe(method);
		expect(JSON.parse(requests()[0]?.body.toString() ?? "")).toEqual({ title: "New title" });
		expect(requests()[0]?.headers["content-type"]).toContain("application/json");
	});
}

github.it(
	"retains only the latest thousand conditional representations",
	[currentEtag],
	function* ({ readPull, requests }) {
		for (let number = 1; number <= 1001; number += 1) {
			yield* readPull(number);
		}
		yield* readPull(1001);
		yield* readPull(1);
		expect(requests().at(-2)?.headers["if-none-match"]).toBe('"current"');
		expect(requests().at(-1)?.headers["if-none-match"]).toBeUndefined();
	},
	20_000,
);

github.it("records the core resource budget from a successful response", [coreNearlySpent], function* ({ readPull, observations }) {
	yield* readPull();
	expect(yield* observations()).toMatchObject([{ limit: 5000, remaining: 2, resource: "core", used: 4998 }]);
});
