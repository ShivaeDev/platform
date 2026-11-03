import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminScreen, adminScreenAccount, adminScreens } from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it(
	"alice the owner sees registered users and changes bob's role to admin through Users",
	[adminScreenAccount("bob"), adminScreen("/admin/users", "owner")],
	function* ({ choosesRole, refreshesUsers, settle, shownRole, shownUsers }) {
		yield* settle();
		yield* outcomes([
			["accounts", shownUsers, ["alice@app.test", "bob@app.test"]],
			["bob's role", () => shownRole("bob"), "user"],
		]);

		yield* choosesRole("bob", "admin");
		yield* refreshesUsers();

		expect(yield* shownRole("bob")).toBe("admin");
	},
);

adminScreens.it(
	"alice the admin reads bob's role without a role control",
	[adminScreenAccount("bob"), adminScreen("/admin/users")],
	function* ({ roleControl, settle, shownRole }) {
		yield* settle();

		yield* outcomes([
			["bob's role", () => shownRole("bob"), "user"],
			["bob's role control", () => roleControl("bob"), "not offered"],
		]);
	},
);

adminScreens.it(
	"after bob demotes alice to admin, her stale Users control is refused permission to demote bob and he stays owner",
	[adminScreenAccount("bob", "owner"), adminScreen("/admin/users", "owner")],
	function* ({ alert, assignsRole, choosesRole, refreshesUsers, roleControl, settle, shownRole }) {
		yield* settle();
		yield* outcomes([
			["bob's role before", () => shownRole("bob"), "owner"],
			["bob's control before", () => roleControl("bob"), "offered"],
		]);
		yield* assignsRole("bob", "alice", "admin");

		yield* choosesRole("bob", "user");

		expect(yield* alert()).toBe("Permission required to assign roles.");

		yield* refreshesUsers();

		yield* outcomes([
			["bob's role after", () => shownRole("bob"), "owner"],
			["alice's role after", () => shownRole("alice"), "admin"],
			["bob's control after", () => roleControl("bob"), "not offered"],
		]);
	},
);

adminScreens.it(
	"alice without users.read sees Permission denied instead of the Users table",
	[adminScreen("/admin/users", "user")],
	function* ({ heading, settle, shown }) {
		yield* settle();

		yield* outcomes([
			["page", heading, "Permission denied"],
			["users table", () => shown('[aria-label="App users"]'), "hidden"],
		]);
	},
);
