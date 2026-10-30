import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { rejectsNext } from "#test/appFailureTraits.ts";
import { appGithub, holdsInstallationToken } from "#test/appGithub.ts";

appGithub.it(
	"a read GitHub rejects for installation token 1 exchanges installation token 2 and retries once with it",
	[holdsInstallationToken, rejectsNext("pull request 1", 1)],
	function* ({ pullReads, readPull }) {
		yield* readPull();

		expect(yield* pullReads()).toEqual(["installation token 1: 200", "installation token 1: 401", "installation token 2: 200"]);
	},
);

appGithub.it(
	"a read GitHub rejects for installation token 1 and then for token 2 fails as unauthorized",
	[holdsInstallationToken, rejectsNext("pull request 1", 2)],
	function* ({ readPull }) {
		expect(yield* readPull()).toBe("unauthorized");
	},
);

appGithub.it(
	"a read GitHub rejects for installation token 1 and then for token 2 is not retried a third time",
	[holdsInstallationToken, rejectsNext("pull request 1", 2)],
	function* ({ pullReads, readPull }) {
		yield* readPull();

		expect(yield* pullReads()).toEqual(["installation token 1: 200", "installation token 1: 401", "installation token 2: 401"]);
	},
);

appGithub.it(
	"six reads GitHub rejects together for installation token 1 share one exchange of token 2 and all succeed with it",
	[holdsInstallationToken],
	function* ({ pullReadTally, readConcurrentlyAfterRejection, tokensIssued }) {
		expect(yield* tokensIssued()).toEqual(["installation token 1"]);

		yield* readConcurrentlyAfterRejection(6);

		yield* outcomes({
			"pull request reads": [pullReadTally(), { "installation token 1: 200": 1, "installation token 1: 401": 6, "installation token 2: 200": 6 }],
			"tokens issued": [tokensIssued(), ["installation token 1", "installation token 2"]],
		});
	},
);
