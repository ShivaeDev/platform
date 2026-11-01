import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSessions, adminSessionsOpen, withoutSessionsPermission } from "#test-support/admin/sessions.tsx";

adminSessions.it("the Sessions page lists every signed-in user and marks alice's own session", [adminSessionsOpen], function* ({ sessions }) {
	expect(yield* sessions()).toEqual(["alice@app.test (current session)", "bob@app.test"]);
});

adminSessions.it("revoking bob's session removes it from the Sessions page", [adminSessionsOpen], function* ({ revokesSession, sessions }) {
	expect(yield* sessions()).toContain("bob@app.test");

	yield* revokesSession("bob@app.test");

	expect(yield* sessions()).toEqual(["alice@app.test (current session)"]);
});

adminSessions.it("revoking her own session takes alice to sign-in", [adminSessionsOpen], function* ({ heading, revokesSession, sessions }) {
	expect(yield* sessions()).toContain("alice@app.test (current session)");

	yield* revokesSession("alice@app.test");

	yield* outcomes([
		["page", heading, "Sign in"],
		["listed sessions", sessions, []],
	]);
});

adminSessions.it(
	"the Sessions page refuses alice without the sessions permission",
	[withoutSessionsPermission, adminSessionsOpen],
	function* ({ heading, sessions }) {
		yield* outcomes([
			["page", heading, "Permission denied"],
			["listed sessions", sessions, []],
		]);
	},
);
