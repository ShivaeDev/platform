import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cannotAssignRoles, onBobsPage, onPhone, serverRefusesRoleChanges, usersScreen, viewOpen } from "#test/usersScreen.tsx";

expectNoReactWarnings();

const alice = {
	email: "alice@app.test",
	name: "Alice",
	role: "user",
	signedUp: "2026-10-20T12:34:56.000Z",
	signedUpDateTime: "2026-10-20T12:34:56.000Z",
};
const bob = { email: "bob@app.test", name: "Bob", role: "user", signedUp: "2026-10-21T08:00:00.000Z", signedUpDateTime: "2026-10-21T08:00:00.000Z" };

usersScreen.it(
	"a caller who cannot assign roles sees alice's name, email, role and sign-up time on the first page, with no role control",
	[cannotAssignRoles, viewOpen],
	function* ({ roleChoices, shownUsers }) {
		yield* outcomes({
			"alice's role control": [roleChoices("Alice"), "no role control"],
			"shown users": [shownUsers(), [alice]],
		});
	},
);

usersScreen.it(
	"next users moves from alice's page to bob's, the last page, where next users is disabled",
	[viewOpen],
	function* ({ nextUsers, nextUsersButton, shownUsers }) {
		expect(yield* shownUsers()).toEqual([alice]);

		yield* nextUsers();

		yield* outcomes({
			"next users": [nextUsersButton(), "disabled"],
			"shown users": [shownUsers(), [bob]],
		});
	},
);

usersScreen.it("previous users moves from bob's page back to alice's", [viewOpen, onBobsPage], function* ({ previousUsers, shownUsers }) {
	expect(yield* shownUsers()).toEqual([bob]);

	yield* previousUsers();

	expect(yield* shownUsers()).toEqual([alice]);
});

usersScreen.it("a role assigner can choose any of the seven declared roles for alice", [viewOpen], function* ({ roleChoices }) {
	expect(yield* roleChoices("Alice")).toEqual(["user", "assigner", "admin", "owner", "delegate", "auditor", "operator"]);
});

usersScreen.it(
	"at phone width, choosing auditor for alice sends that change, then shows her as auditor with her role control enabled again",
	[onPhone, viewOpen],
	function* ({ chooseRole, requests, roleControl, shownUsers }) {
		expect(yield* shownUsers()).toEqual([alice]);

		yield* chooseRole("Alice", "auditor");

		yield* outcomes({
			"alice's role control": [roleControl("Alice"), "enabled"],
			"sent changes": [requests(), [{ role: "auditor", userId: "alice" }]],
			"shown users": [shownUsers(), [{ ...alice, role: "auditor" }]],
		});
	},
);

for (const [refusal, message] of [
	["last role assigner", "The last user who can assign roles cannot be removed. Assign another user permission to change roles first."],
	["forbidden", "Permission required to assign roles."],
] as const) {
	usersScreen.it(
		`when the server refuses alice's change as ${refusal}, the view says "${message}" and still shows her as user`,
		[serverRefusesRoleChanges(refusal), viewOpen],
		function* ({ alert, chooseRole, shownUsers }) {
			yield* chooseRole("Alice", "admin");

			yield* outcomes({
				alert: [alert(), message],
				"shown users": [shownUsers(), [alice]],
			});
		},
	);
}
