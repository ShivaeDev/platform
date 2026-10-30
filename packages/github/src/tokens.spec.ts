import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { github } from "#test/github.ts";
import { connectionDrops, connectionResetsMidBody, tokenRejected } from "#test/traits.ts";

for (const [variables, sent] of [
	[["GH_TOKEN", "GITHUB_TOKEN"], "GH_TOKEN"],
	[["GITHUB_TOKEN"], "GITHUB_TOKEN"],
	[[], "no credential"],
] as const) {
	github.it(
		`a client built from an environment with ${variables.join(" and ") || "neither token variable"} reads with ${sent}`,
		[],
		function* ({ credentialsSent, readWithEnvironment }) {
			yield* readWithEnvironment(variables);

			expect(yield* credentialsSent()).toEqual([sent]);
		},
	);
}

github.it(
	"a dropped connection fails the read as a transport failure at its path without the query",
	[connectionDrops],
	function* ({ readPullWithPrivateQuery }) {
		expect(yield* readPullWithPrivateQuery()).toBe("transport failure at /repos/acme/widgets/pulls/1");
	},
);

github.it(
	"a connection reset in the middle of the body fails the read as a transport failure at its path without the query",
	[connectionResetsMidBody],
	function* ({ readPullWithPrivateQuery }) {
		expect(yield* readPullWithPrivateQuery()).toBe("transport failure at /repos/acme/widgets/pulls/1");
	},
);

github.it(
	"a dropped read records its span but keeps the configured token out of failures, logs and spans and the private query out of failures, logs and span events",
	[connectionDrops],
	function* ({ privateQuerySeenIn, readPullWithPrivateQuery, spanNames, tokenSeenIn }) {
		yield* readPullWithPrivateQuery();

		yield* outcomes({
			"private query seen in": [privateQuerySeenIn(), []],
			"spans recorded": [spanNames(), expect.arrayContaining(["GitHub request"])],
			"token seen in": [tokenSeenIn(), []],
		});
	},
);

github.it("a read GitHub answers 401 for the configured token is not retried", [tokenRejected], function* ({ readPull, requests }) {
	yield* readPull();

	expect(yield* requests()).toEqual(["GET /repos/acme/widgets/pulls/1 401"]);
});
