import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { permissionScreens, visitor } from "#test/permission-routes/story.tsx";

permissionScreens.it(
	"a signed-out visitor to a signed-in-only parent is sent to sign-in with the full return location",
	[visitor(undefined)],
	function* ({ heading, path, returnTo, visit }) {
		yield* visit("/account/profile?tab=settings#email");

		yield* outcomes({
			heading: [heading(), "Sign in"],
			path: [path(), "/login"],
			"return to": [returnTo(), "/account/profile?tab=settings#email"],
		});
	},
);

permissionScreens.it(
	"a signed-in viewer without permissions opens a signed-in-only route",
	[visitor("guest")],
	function* ({ heading, location, visit }) {
		yield* visit("/account/profile");

		yield* outcomes({ heading: [heading(), "Profile"], location: [location(), "/account/profile"] });
	},
);

permissionScreens.it("a signed-out viewer opens a route without a requirement", [visitor(undefined)], function* ({ heading, location, visit }) {
	yield* visit("/controls");

	yield* outcomes({ heading: [heading(), "Controls"], location: [location(), "/controls"] });
});

permissionScreens.it(
	"a signed-in parent does not bypass a child's permission requirement",
	[visitor("guest")],
	function* ({ heading, location, visit }) {
		yield* visit("/account/private");

		yield* outcomes({ heading: [heading(), "Permission denied"], location: [location(), "/account/private"] });
	},
);
