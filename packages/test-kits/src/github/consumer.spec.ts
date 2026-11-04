import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { githubConsumer, QUERY } from "#test/githubConsumer.ts";

githubConsumer.it(
	"an application exchanges an installation token, reads GitHub, posts a comment and verifies a signed delivery",
	[],
	function* ({ readIssue, readRepository, postComment, deliverIssue, verifiedDelivery, requests }) {
		const issue = yield* readIssue();
		expect(issue).toEqual({ title: "Ship widgets" });
		const repository = yield* readRepository();
		expect(repository).toEqual({ repository: { name: "widgets" } });
		const comment = yield* postComment("Ready to ship");
		expect(comment).toEqual({ body: "Ready to ship", id: 9 });
		const status = yield* deliverIssue(3);
		expect(status).toBe(HttpStatus.fromLiteral("Accepted"));

		expect(yield* verifiedDelivery()).toEqual({ deliveryId: "issue-delivery", event: "issues", payload: { action: "opened", issue: { number: 3 } } });
		const sent = yield* requests();
		expect(sent).toEqual([
			{ authorization: expect.stringMatching(/^Bearer ey/u), body: "{}", method: "POST", path: "/app/installations/7/access_tokens" },
			{ authorization: "Bearer installation-token-secret-1", body: "", method: "GET", path: "/repos/acme/widgets/issues/3" },
			{
				authorization: "Bearer installation-token-secret-1",
				body: JSON.stringify({ query: QUERY, variables: { owner: "acme" } }),
				method: "POST",
				path: "/graphql",
			},
			{
				authorization: "Bearer installation-token-secret-1",
				body: JSON.stringify({ body: "Ready to ship" }),
				method: "POST",
				path: "/repos/acme/widgets/issues/3/comments",
			},
		]);
	},
);

githubConsumer.it("an application sees the provider's secondary rate limit", [], function* ({ rateLimited, readLimitedIssue }) {
	yield* rateLimited();

	expect(yield* readLimitedIssue()).toBe("rate limited on core until 1970-01-01T00:00:30.000Z");
});
