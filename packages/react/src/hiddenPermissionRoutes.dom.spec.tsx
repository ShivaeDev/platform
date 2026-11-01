import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hiddenRoutes, permissionScreens, visitor } from "#test/permission-routes/story.tsx";

permissionScreens.it(
	"a member opening a hidden admin URL sees not-found without running its loader",
	[visitor("reader"), hiddenRoutes],
	function* ({ heading, location, requests, visit }) {
		yield* visit("/admin/users");

		yield* outcomes([
			["heading", () => heading(), "Page not found"],
			["location", () => location(), "/admin/users"],
			["requests", () => requests(), []],
		]);
	},
);

permissionScreens.it(
	"a supervisor opens a hidden admin URL and runs its loader",
	[visitor("supervisor"), hiddenRoutes],
	function* ({ heading, requests, visit }) {
		yield* visit("/admin/users");

		yield* outcomes([
			["heading", () => heading(), "Admin users"],
			["requests", () => requests(), ["POST /rpc/"]],
		]);
	},
);

permissionScreens.it(
	"a signed-out visitor to a hidden admin URL goes to sign-in with the return location",
	[visitor(undefined), hiddenRoutes],
	function* ({ heading, path, returnTo, visit }) {
		yield* visit("/admin/users?tab=members#active");

		yield* outcomes([
			["heading", () => heading(), "Sign in"],
			["path", () => path(), "/login"],
			["return to", () => returnTo(), "/admin/users?tab=members#active"],
		]);
	},
);
