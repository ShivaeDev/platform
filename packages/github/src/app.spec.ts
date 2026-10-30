import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appGithub, clockReadsTwoMinutes, exchangeRefused, holdsInstallationToken } from "#test/appGithub.ts";

const APP_JWT = { algorithm: "RS256", expiresIn: 600, issuedAgo: 60, issuer: "123456", signedBy: "the App's key", type: "JWT" };

appGithub.it(
	"a first read through installation 7 exchanges an App JWT for installation token 1 and reads with it",
	[],
	function* ({ readPull, requests }) {
		yield* readPull();

		expect(yield* requests()).toEqual([
			"POST /app/installations/7/access_tokens 200 with an App JWT",
			"GET /repos/acme/widgets/pulls/1 200 with installation token 1",
		]);
	},
);

appGithub.it(
	"a read 54 minutes after the exchange still uses installation token 1",
	[holdsInstallationToken],
	function* ({ pullReads, readPull, timePasses }) {
		yield* timePasses("54 minutes");

		yield* readPull();

		expect(yield* pullReads()).toEqual(["installation token 1: 200", "installation token 1: 200"]);
	},
);

appGithub.it(
	"a read 55 minutes after the exchange, five minutes before the token expires, exchanges installation token 2 and reads with it",
	[holdsInstallationToken],
	function* ({ pullReads, readPull, timePasses }) {
		yield* timePasses("55 minutes");

		yield* readPull();

		expect(yield* pullReads()).toEqual(["installation token 1: 200", "installation token 2: 200"]);
	},
);

appGithub.it(
	"twelve reads together at the refresh point share one exchange and all read with installation token 2",
	[holdsInstallationToken],
	function* ({ pullReadTally, readConcurrently, timePasses, tokensIssued }) {
		yield* timePasses("55 minutes");
		expect(yield* tokensIssued()).toEqual(["installation token 1"]);

		yield* readConcurrently(12);

		yield* outcomes({
			"pull request reads": [pullReadTally(), { "installation token 1: 200": 1, "installation token 2: 200": 12 }],
			"tokens issued": [tokensIssued(), ["installation token 1", "installation token 2"]],
		});
	},
);

appGithub.it(
	"a client for acme/widgets looks up its installation with an App JWT, exchanges a token for it and reads with installation token 1",
	[],
	function* ({ readRepositoryPull, requests }) {
		yield* readRepositoryPull();

		expect(yield* requests()).toEqual([
			"GET /repos/acme/widgets/installation 200 with an App JWT",
			"POST /app/installations/7/access_tokens 200 with an App JWT",
			"GET /repos/acme/widgets/pulls/1 200 with installation token 1",
		]);
	},
);

appGithub.it(
	"a client for acme/widgets that exchanges installation token 2 at the refresh point does not look up its installation again",
	[],
	function* ({ readRepositoryPull, requests, timePasses }) {
		yield* readRepositoryPull();
		yield* timePasses("55 minutes");

		yield* readRepositoryPull();

		expect(yield* requests()).toEqual([
			"GET /repos/acme/widgets/installation 200 with an App JWT",
			"POST /app/installations/7/access_tokens 200 with an App JWT",
			"GET /repos/acme/widgets/pulls/1 200 with installation token 1",
			"POST /app/installations/7/access_tokens 200 with an App JWT",
			"GET /repos/acme/widgets/pulls/1 200 with installation token 2",
		]);
	},
);

appGithub.it(
	"at 00:02:00 each App JWT is RS256, signed by the App's key, issued by App 123456 60 seconds back and expires ten minutes ahead",
	[clockReadsTwoMinutes],
	function* ({ appJwts, readRepositoryPull }) {
		yield* readRepositoryPull();

		expect(yield* appJwts()).toEqual([APP_JWT, APP_JWT]);
	},
);

appGithub.it(
	"a token exchange GitHub refuses with 401 fails the read as an exchange refused with HTTP 401",
	[exchangeRefused],
	function* ({ readPull }) {
		expect(yield* readPull()).toBe("token exchange refused with HTTP 401");
	},
);
