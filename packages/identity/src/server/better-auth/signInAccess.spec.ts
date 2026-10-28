import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	allowed,
	applicationRefusesNewSessions,
	type MalformedList,
	membershipChecksDown,
	moreThanOnePageOfUnlistedUsers,
	organizationRule,
	signedIn,
	signedInOnTwoDevices,
	signInPolicy,
} from "#test/sign-in-policy/story.ts";

signInPolicy.it("alice, who is on the list, signs in with GitHub and her next request succeeds", [allowed("alice")], function* ({ request, signIn }) {
	yield* signIn("alice");

	expect(yield* request("alice")).toBe("ok");
});

signInPolicy.it(
	"bob, who is not on the list, is refused at sign-in before a user is stored for him",
	[allowed("alice")],
	function* ({ signIn, signInAnswer, storedUsers }) {
		yield* signIn("bob");

		yield* outcomes({
			"bob's sign-in": [signInAnswer("bob"), "refused"],
			"stored users": [storedUsers(), []],
		});
	},
);

signInPolicy.it("dana's email sign-up is refused while an allowed list is set", [allowed("alice")], function* ({ signUpAnswer, signUpWithEmail }) {
	yield* signUpWithEmail("dana");

	expect(yield* signUpAnswer("dana")).toBe("refused");
});

signInPolicy.it(
	"removing bob from the list refuses his next request and his next sign-in, ends both his sessions, and leaves alice signed in",
	[allowed("alice", "bob"), signedIn("alice"), signedInOnTwoDevices("bob")],
	function* ({ remove, request, signIn, storedSessions }) {
		expect(yield* storedSessions("bob")).toEqual(["laptop", "phone"]);

		yield* remove("bob");

		yield* outcomes({
			"alice's next request": [request("alice"), "ok"],
			"bob signs in again": [signIn("bob"), "refused"],
			"bob's next request": [request("bob"), "unauthorized"],
			"bob's stored sessions": [storedSessions("bob"), []],
		});
	},
);

signInPolicy.it(
	"alice keeps her access until the recheck interval passes after she leaves the organization",
	[organizationRule, signedIn("alice")],
	function* ({ leaveOrganization, recheckIntervalPasses, request }) {
		yield* leaveOrganization("alice");

		expect(yield* request("alice")).toBe("ok");

		yield* recheckIntervalPasses();

		expect(yield* request("alice")).toBe("unauthorized");
	},
);

signInPolicy.it(
	"once the recheck finds alice outside the organization, her stored session ends and her next sign-in is refused",
	[organizationRule, signedIn("alice")],
	function* ({ leaveOrganization, recheckIntervalPasses, request, signIn, storedSessions }) {
		expect(yield* storedSessions("alice")).toEqual(["browser"]);

		yield* leaveOrganization("alice");
		yield* recheckIntervalPasses();

		yield* outcomes({
			"alice signs in again": [signIn("alice"), "refused"],
			"alice's next request": [request("alice"), "unauthorized"],
			"alice's stored sessions": [storedSessions("alice"), []],
		});
	},
);

signInPolicy.it(
	"while GitHub cannot answer membership checks, alice's next request after the recheck interval is answered auth unavailable and her session is kept",
	[organizationRule, signedIn("alice"), membershipChecksDown],
	function* ({ recheckIntervalPasses, request, storedSessions }) {
		yield* recheckIntervalPasses();

		yield* outcomes({
			"alice's next request": [request("alice"), "auth unavailable"],
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
		});
	},
);

signInPolicy.it(
	"while GitHub cannot answer membership checks, alice's sign-in after the recheck interval is unavailable and adds no session",
	[organizationRule, signedIn("alice"), membershipChecksDown],
	function* ({ recheckIntervalPasses, signIn, signInAnswer, storedSessions }) {
		yield* recheckIntervalPasses();

		yield* signIn("alice");

		yield* outcomes({
			"alice's sign-in": [signInAnswer("alice"), "unavailable"],
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
		});
	},
);

signInPolicy.it(
	"while GitHub cannot answer membership checks, carol's first sign-in is unavailable before a user is stored for her",
	[organizationRule, membershipChecksDown],
	function* ({ signIn, signInAnswer, storedUsers }) {
		yield* signIn("carol");

		yield* outcomes({
			"carol's sign-in": [signInAnswer("carol"), "unavailable"],
			"stored users": [storedUsers(), []],
		});
	},
);

signInPolicy.it(
	"revoking while GitHub cannot answer membership checks stops with a failed policy check and keeps alice's session",
	[organizationRule, signedIn("alice"), membershipChecksDown],
	function* ({ recheckIntervalPasses, revocation, revoke, storedSessions }) {
		yield* recheckIntervalPasses();

		yield* revoke();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
			"the revocation": [revocation(), "stopped by a failed policy check"],
		});
	},
);

signInPolicy.it(
	"revoking after bob and carol leave the list ends their three sessions and keeps alice's",
	[allowed("alice", "bob", "carol"), signedIn("alice"), signedInOnTwoDevices("bob"), signedIn("carol")],
	function* ({ remove, revocation, revoke, storedSessions }) {
		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
			"bob's stored sessions": [storedSessions("bob"), ["laptop", "phone"]],
			"carol's stored sessions": [storedSessions("carol"), ["browser"]],
		});

		yield* remove("bob", "carol");
		yield* revoke();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
			"bob's stored sessions": [storedSessions("bob"), []],
			"carol's stored sessions": [storedSessions("carol"), []],
			"the revocation": [revocation(), { sessions: 3, users: 2 }],
		});
	},
);

signInPolicy.it(
	"a second revocation after bob leaves the list revokes nothing",
	[allowed("alice", "bob"), signedIn("bob")],
	function* ({ remove, revocation, revoke }) {
		yield* remove("bob");
		yield* revoke();
		expect(yield* revocation()).toEqual({ sessions: 1, users: 1 });

		yield* revoke();

		expect(yield* revocation()).toEqual({ sessions: 0, users: 0 });
	},
);

signInPolicy.it(
	"revoking reaches unlisted users beyond the first page it reads and keeps alice's session",
	[allowed("alice"), signedIn("alice"), moreThanOnePageOfUnlistedUsers],
	function* ({ revocation, revoke, sessionHolders }) {
		yield* revoke();

		yield* outcomes({
			"the revocation": [revocation(), { sessions: 120, users: 120 }],
			"users still holding a session": [sessionHolders(), ["alice"]],
		});
	},
);

signInPolicy.it(
	"after the list turns malformed, alice's next request is answered auth unavailable and her session is kept",
	[allowed("alice"), signedIn("alice")],
	function* ({ corruptList, request, storedSessions }) {
		yield* corruptList("a provider without an account id");

		yield* outcomes({
			"alice's next request": [request("alice"), "auth unavailable"],
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
		});
	},
);

signInPolicy.it(
	"revoking after the list turns malformed stops with a configuration error and keeps alice's session",
	[allowed("alice"), signedIn("alice")],
	function* ({ corruptList, revocation, revoke, storedSessions }) {
		yield* corruptList("a provider without an account id");

		yield* revoke();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
			"the revocation": [revocation(), "stopped by a configuration error"],
		});
	},
);

signInPolicy.it(
	"the application's own session hook still refuses alice's next sign-in under an allowed list, so she gets no new session",
	[allowed("alice"), signedIn("alice"), applicationRefusesNewSessions],
	function* ({ signIn, signInAnswer, storedSessions }) {
		yield* signIn("alice");

		yield* outcomes({
			"alice's sign-in": [signInAnswer("alice"), "failed: unable_to_create_session"],
			"alice's stored sessions": [storedSessions("alice"), ["browser"]],
		});
	},
);

signInPolicy.it("without an allowed list or rule, bob signs in with GitHub and his next request succeeds", [], function* ({ request, signIn }) {
	yield* signIn("bob");

	expect(yield* request("bob")).toBe("ok");
});

signInPolicy.it(
	"without an allowed list or rule, dana's email sign-up succeeds and signs her in",
	[],
	function* ({ signUpAnswer, signUpWithEmail, storedSessions }) {
		yield* signUpWithEmail("dana");

		yield* outcomes({
			"dana's sign-up": [signUpAnswer("dana"), "signed up"],
			"dana's stored sessions": [storedSessions("dana"), ["browser"]],
		});
	},
);

signInPolicy.it(
	"without an allowed list or rule, revoking revokes nothing and bob keeps his session",
	[signedIn("bob")],
	function* ({ revocation, revoke, storedSessions }) {
		yield* revoke();

		yield* outcomes({
			"bob's stored sessions": [storedSessions("bob"), ["browser"]],
			"the revocation": [revocation(), { sessions: 0, users: 0 }],
		});
	},
);

for (const malformed of ["an empty list", "a provider without an account id"] satisfies MalformedList[]) {
	signInPolicy.it(
		`an allowed list set to ${malformed} stops the application at its next startup`,
		[allowed("alice")],
		function* ({ corruptList, restart, startup }) {
			yield* corruptList(malformed);

			yield* restart();

			expect(yield* startup()).toMatch(/^refused to start: .*AUTH_ALLOWED_ACCOUNTS/u);
		},
	);
}
