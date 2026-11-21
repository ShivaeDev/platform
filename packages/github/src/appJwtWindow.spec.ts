import { expect } from "vitest";
import { appGithub } from "#test/appGithub.ts";

for (const seconds of [5, 59, -539]) {
	appGithub.it(
		`a host clock ${Math.abs(seconds)} seconds ${seconds > 0 ? "ahead of" : "behind"} GitHub's signs an App JWT GitHub accepts for installation token 1`,
		[],
		function* ({ readPullWithHostClock, requests }) {
			yield* readPullWithHostClock(seconds);

			expect(yield* requests()).toEqual([
				"POST /app/installations/7/access_tokens 200 with an App JWT",
				"GET /repos/acme/widgets/pulls/1 200 with installation token 1",
			]);
		},
	);
}
