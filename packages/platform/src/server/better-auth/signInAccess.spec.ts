import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { allowedList, organizationRule, signInPolicy } from "#test/sign-in-policy/story.ts";

signInPolicy.it(
	"an allowed GitHub account signs in and an unlisted one is refused before a user exists",
	[allowedList("github:1001")],
	function* ({ signIn, storedSessions, storedUsers, whoami }) {
		expect(yield* signIn("alice")).toEqual({ signedIn: true });
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Success" });
		expect(yield* signIn("bob")).toEqual({ error: "sign_in_refused", signedIn: false });
		expect(yield* storedUsers()).toEqual(["alice@github.test"]);
		expect(yield* storedSessions()).toEqual({ "alice@github.test": 1 });
	},
);

signInPolicy.it("an email sign-up is refused while a policy is active", [allowedList("github:1001")], function* ({ signUpWithEmail, storedUsers }) {
	expect(yield* signUpWithEmail("dana@example.test")).toEqual({ code: "sign_in_refused", status: 403 });
	expect(yield* storedUsers()).toEqual([]);
});

signInPolicy.it(
	"a user removed from the list is refused on the next request and loses every stored session",
	[allowedList("github:1001", "github:1002")],
	function* ({ allowOnly, signIn, storedSessions, whoami }) {
		expect(yield* signIn("alice")).toEqual({ signedIn: true });
		expect(yield* signIn("bob")).toEqual({ signedIn: true });
		expect(yield* signIn("bob")).toEqual({ signedIn: true });
		expect(yield* whoami("bob")).toMatchObject({ _tag: "Success" });
		yield* allowOnly("github:1001");
		expect(yield* whoami("bob")).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(yield* storedSessions()).toEqual({ "alice@github.test": 1, "bob@github.test": 0 });
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Success" });
		expect(yield* signIn("bob")).toEqual({ error: "sign_in_refused", signedIn: false });
	},
);

signInPolicy.it(
	"an organization rule that turns false refuses the user once the recheck interval passes",
	[organizationRule("300 millis")],
	function* ({ leaveOrganization, membershipChecks, signIn, storedSessions, waitForRecheck, whoami }) {
		expect(yield* signIn("alice")).toEqual({ signedIn: true });
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Success" });
		const checksWhileSignedIn = membershipChecks();
		yield* leaveOrganization("alice");
		yield* waitForRecheck("300 millis");
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(membershipChecks()).toBe(checksWhileSignedIn + 1);
		expect(yield* storedSessions()).toEqual({ "alice@github.test": 0 });
		expect(yield* signIn("alice")).toEqual({ error: "sign_in_refused", signedIn: false });
	},
);

signInPolicy.it(
	"an organization check outage answers AuthUnavailable and keeps the session",
	[organizationRule("300 millis")],
	function* ({ membershipOutage, signIn, storedSessions, waitForRecheck, whoami }) {
		expect(yield* signIn("alice")).toEqual({ signedIn: true });
		yield* membershipOutage();
		yield* waitForRecheck("300 millis");
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable" } });
		expect(yield* storedSessions()).toEqual({ "alice@github.test": 1 });
		expect(yield* signIn("alice")).toEqual({ error: "sign_in_unavailable", signedIn: false });
	},
);

signInPolicy.it(
	"revoking after the list shrinks removes exactly the sessions of users no longer on it",
	[allowedList("github:1001", "github:1002", "github:1003")],
	function* ({ allowOnly, revokeUnadmitted, signIn, storedSessions, whoami }) {
		for (const person of ["alice", "bob", "bob", "carol"] as const) {
			expect(yield* signIn(person)).toEqual({ signedIn: true });
		}
		yield* allowOnly("github:1001");
		expect(yield* revokeUnadmitted()).toEqual({ sessions: 3, users: 2 });
		expect(yield* storedSessions()).toEqual({ "alice@github.test": 1, "bob@github.test": 0, "carol@github.test": 0 });
		expect(yield* whoami("alice")).toMatchObject({ _tag: "Success" });
		expect(yield* revokeUnadmitted()).toEqual({ sessions: 0, users: 0 });
	},
);

signInPolicy.it(
	"without a policy any GitHub account or email sign-up signs in and keeps its session",
	[],
	function* ({ revokeUnadmitted, signIn, signUpWithEmail, storedSessions, whoami }) {
		expect(yield* signIn("bob")).toEqual({ signedIn: true });
		expect(yield* signUpWithEmail("dana@example.test")).toEqual({ code: undefined, status: 200 });
		expect(yield* whoami("bob")).toMatchObject({ _tag: "Success" });
		expect(yield* revokeUnadmitted()).toEqual({ sessions: 0, users: 0 });
		expect(yield* storedSessions()).toEqual({ "bob@github.test": 1, "dana@example.test": 1 });
	},
);

for (const value of ["github", ""]) {
	signInPolicy.it(
		`a list of ${JSON.stringify(value)} stops the application at startup`,
		[allowedList("github:1001")],
		function* ({ allowOnly, restart }) {
			yield* allowOnly(value);
			const restarted = yield* restart();
			expect(Exit.isFailure(restarted) ? Cause.pretty(restarted.cause) : "started").toContain("AUTH_ALLOWED_ACCOUNTS");
		},
	);
}
