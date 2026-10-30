import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { auth } from "#test/auth/story.ts";

auth.it("a profile lookup returns only the known users' ids, names and images", [], function* ({ lookupProfiles, signInProfile }) {
	const ada = yield* signInProfile({ email: "ada@example.test", image: "https://example.test/ada.png", name: "Ada" });
	const grace = yield* signInProfile({ email: "grace@example.test", name: "Grace" });

	expect(yield* lookupProfiles([ada.user.id, "unknown-user", grace.user.id])).toEqual([
		{ id: ada.user.id, image: "https://example.test/ada.png", name: "Ada" },
		{ id: grace.user.id, image: null, name: "Grace" },
	]);
});

auth.it("a Better Auth rename appears on Ada's next profile lookup", [], function* ({ lookupProfiles, renameProfile, signInProfile }) {
	const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
	expect(yield* lookupProfiles([ada.user.id])).toEqual([{ id: ada.user.id, image: null, name: "Ada" }]);

	yield* renameProfile(ada.headers, "Ada Lovelace");

	expect(yield* lookupProfiles([ada.user.id])).toEqual([{ id: ada.user.id, image: null, name: "Ada Lovelace" }]);
});

auth.it(
	"a profile batch with a duplicate id reads storage once for the distinct ids",
	[],
	function* ({ lookupProfiles, profileQueries, signInProfile }) {
		const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
		const grace = yield* signInProfile({ email: "grace@example.test", name: "Grace" });

		yield* lookupProfiles([ada.user.id, grace.user.id, ada.user.id]);

		expect(yield* profileQueries()).toEqual([[ada.user.id, grace.user.id, 2]]);
	},
);

auth.it("an empty profile lookup returns no profiles without a storage query", [], function* ({ lookupProfiles, profileQueries }) {
	const profiles = yield* lookupProfiles([]);

	yield* outcomes({
		"profiles": [Effect.succeed(profiles), []],
		"storage queries": [profileQueries(), []],
	});
});

auth.it(
	"during an auth storage outage, a profile lookup fails as auth unavailable, logs the provider failure and keeps the provider cause out of the failure",
	[],
	function* ({ lookupFailure, lookupProfiles, providerLogs, signInProfile, stopAuthStorage }) {
		const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
		yield* stopAuthStorage();

		expect(yield* lookupProfiles([ada.user.id])).toBe("failed with auth unavailable");

		yield* outcomes({
			failure: [lookupFailure(), { cause: "none", text: "AuthUnavailable: Authentication is temporarily unavailable" }],
			"provider logs": [
				providerLogs(),
				[["Authentication provider failed", expect.objectContaining({ message: "Cannot use a pool after calling end on the pool" })]],
			],
		});
	},
);
