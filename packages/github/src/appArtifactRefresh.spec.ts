import { expect } from "vitest";
import { rejectsNext } from "#test/appFailureTraits.ts";
import { appGithub, holdsInstallationToken } from "#test/appGithub.ts";

appGithub.it(
	"an archive download GitHub rejects for installation token 1 exchanges installation token 2 and retries once with it",
	[holdsInstallationToken, rejectsNext("the archive", 1)],
	function* ({ downloadArchive, zipRequests }) {
		yield* downloadArchive();

		expect(yield* zipRequests()).toEqual(["installation token 1: 401", "installation token 2: 302"]);
	},
);

appGithub.it(
	"an archive download GitHub rejects for installation token 1 and then for token 2 fails as unauthorized",
	[holdsInstallationToken, rejectsNext("the archive", 2)],
	function* ({ downloadArchive }) {
		expect(yield* downloadArchive()).toBe("unauthorized");
	},
);

appGithub.it(
	"an archive download GitHub rejects for installation token 1 and then for token 2 is not retried a third time",
	[holdsInstallationToken, rejectsNext("the archive", 2)],
	function* ({ downloadArchive, zipRequests }) {
		yield* downloadArchive();

		expect(yield* zipRequests()).toEqual(["installation token 1: 401", "installation token 2: 401"]);
	},
);
