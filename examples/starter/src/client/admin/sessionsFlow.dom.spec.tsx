import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSessions, adminSessionsOpen, withoutSessionsPermission } from "#test-support/adminSessions.tsx";

adminSessions.it(
	"the mounted Sessions page lists signed-in users and marks alice's current session",
	[adminSessionsOpen],
	function* ({ content, sessionEmails }) {
		yield* outcomes([
			["content", () => content(), expect.stringContaining("Your current session")],
			["sessions", () => sessionEmails(), expect.arrayContaining(["alice@app.test", "bob@app.test"])],
		]);
	},
);

adminSessions.it("confirming revocation on the mounted page removes bob's session", [adminSessionsOpen], function* ({ click, sessionEmails }) {
	expect(yield* sessionEmails()).toContain("bob@app.test");
	yield* click("Revoke session for bob@app.test");

	yield* click("Confirm revoke");

	expect(yield* sessionEmails()).toEqual(["alice@app.test"]);
});

adminSessions.it(
	"revoking alice's current session leaves the admin page and shows sign-in",
	[adminSessionsOpen],
	function* ({ click, content, sessionEmails }) {
		expect(yield* content()).toContain("Your current session");
		yield* click("Revoke session for alice@app.test");

		yield* click("Confirm revoke");

		yield* outcomes([
			["admin sessions", () => sessionEmails(), []],
			["content", () => content(), expect.stringContaining("Sign in")],
		]);
	},
);

adminSessions.it(
	"the mounted page refuses a viewer without the sessions permission",
	[withoutSessionsPermission, adminSessionsOpen],
	function* ({ content, sessionEmails }) {
		yield* outcomes([
			["content", () => content(), expect.stringContaining("Permission denied")],
			["sessions", () => sessionEmails(), []],
		]);
	},
);
