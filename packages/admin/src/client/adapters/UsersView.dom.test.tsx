import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bobCanAssignRoles, cannotAssignRoles, onLastPage, twentyOneUsers, usersScreen, viewOpen } from "#test/usersScreen.tsx";

expectNoReactWarnings();

const alice = {
	email: "alice@app.test",
	name: "alice",
	role: "owner",
	signedUp: "2026-10-20T12:34:56.000Z",
	signedUpDateTime: "2026-10-20T12:34:56.000Z",
};
const bob = { ...alice, email: "bob@app.test", name: "bob", role: "user" };
const carol = { ...alice, email: "carol@app.test", name: "carol", role: "auditor" };
const firstPage = [
	"alice",
	"bob",
	"carol",
	"d01",
	"d02",
	"d03",
	"d04",
	"d05",
	"d06",
	"d07",
	"d08",
	"d09",
	"d10",
	"d11",
	"d12",
	"d13",
	"d14",
	"d15",
	"d16",
	"d17",
];

usersScreen.it(
	"carol can read users' names, emails, roles and sign-up times without role controls",
	[cannotAssignRoles, viewOpen],
	function* ({ roleControl, shownUsers }) {
		yield* outcomes([
			["alice's role control", () => roleControl("alice"), "no role control"],
			["shown users", () => shownUsers(), [alice, bob, carol]],
		]);
	},
);

usersScreen.it(
	"next users moves from twenty users to the twenty-first user, where next users is disabled",
	[twentyOneUsers, viewOpen],
	function* ({ nextUsers, nextUsersButton, shownNames }) {
		expect(yield* shownNames()).toEqual(firstPage);

		yield* nextUsers();

		yield* outcomes([
			["next users", () => nextUsersButton(), "disabled"],
			["shown users", () => shownNames(), ["d18"]],
		]);
	},
);

usersScreen.it(
	"previous users returns from the last page to the first twenty users",
	[twentyOneUsers, viewOpen, onLastPage],
	function* ({ previousUsers, shownNames }) {
		expect(yield* shownNames()).toEqual(["d18"]);

		yield* previousUsers();

		expect(yield* shownNames()).toEqual(firstPage);
	},
);

usersScreen.it(
	"alice makes bob an auditor and sees his saved role with the role control enabled again",
	[viewOpen],
	function* ({ chooseRole, roleControl, shownUsers }) {
		expect(yield* shownUsers()).toEqual([alice, bob, carol]);

		yield* chooseRole("bob", "auditor");

		yield* outcomes([
			["bob's role control", () => roleControl("bob"), "enabled"],
			["shown users", () => shownUsers(), [alice, { ...bob, role: "auditor" }, carol]],
		]);
	},
);

usersScreen.it(
	"alice cannot remove herself as the last role assigner and sees the reason while remaining owner",
	[viewOpen],
	function* ({ alert, chooseRole, refreshUsers, shownRole }) {
		expect(yield* shownRole("alice")).toBe("owner");

		yield* chooseRole("alice", "admin");

		expect(yield* alert()).toBe("The last user who can assign roles cannot be removed. Assign another user permission to change roles first.");

		yield* refreshUsers();

		expect(yield* shownRole("alice")).toBe("owner");
	},
);

usersScreen.it(
	"after bob revokes alice's assignment permission, her stale role control is forbidden to make bob an owner and he stays a delegate",
	[bobCanAssignRoles, viewOpen],
	function* ({ alert, assignFromAnotherClient, chooseRole, refreshUsers, roleControl, shownRole }) {
		yield* outcomes([
			["bob's role control", () => roleControl("bob"), "enabled"],
			["bob's role", () => shownRole("bob"), "delegate"],
		]);
		yield* assignFromAnotherClient("bob", "alice", "auditor");

		yield* chooseRole("bob", "owner");

		expect(yield* alert()).toBe("Permission required to assign roles.");

		yield* refreshUsers();

		expect(yield* shownRole("bob")).toBe("delegate");
	},
);
