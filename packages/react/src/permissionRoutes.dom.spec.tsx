import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { permissionScreens, visited, visitor } from "#test/permission-routes/story.tsx";

for (const role of ["reader", "supervisor"] as const) {
	permissionScreens.it(
		`a ${role} opens the guarded note route and reads it over HTTP`,
		[visitor(role)],
		function* ({ heading, location, requests, visit }) {
			yield* visit("/notes/first");

			yield* outcomes({
				heading: [heading(), "Note first"],
				location: [location(), "/notes/first"],
				requests: [requests(), ["POST /rpc/"]],
			});
		},
	);
}

permissionScreens.it(
	"a refused route renders the fallback at its URL without requesting its loader query",
	[visitor("guest")],
	function* ({ heading, location, requests, visit }) {
		yield* visit("/notes/first");

		yield* outcomes({
			heading: [heading(), "Permission denied"],
			location: [location(), "/notes/first"],
			requests: [requests(), []],
		});
	},
);

permissionScreens.it(
	"a signed-out visitor is sent to sign in with the full requested location to return to",
	[visitor(undefined)],
	function* ({ heading, path, requests, returnTo, visit }) {
		yield* visit("/notes/first?tab=history#latest");

		yield* outcomes({
			heading: [heading(), "Sign in"],
			path: [path(), "/login"],
			requests: [requests(), []],
			"return to": [returnTo(), "/notes/first?tab=history#latest"],
		});
	},
);

permissionScreens.it(
	"signing in returns to the full requested location",
	[visited(undefined, "/notes/first?tab=history#latest")],
	function* ({ heading, location, requests, signIn }) {
		yield* signIn();

		yield* outcomes({
			heading: [heading(), "Note first"],
			location: [location(), "/notes/first?tab=history#latest"],
			requests: [requests(), ["POST /rpc/"]],
		});
	},
);

for (const [role, shown] of [
	[undefined, []],
	["guest", []],
	["reader", ["Read notes"]],
	["supervisor", ["Read notes", "Read anyone's notes"]],
] as const) {
	permissionScreens.it(
		`can shows ${role ? `a ${role}` : "a signed-out visitor"} only the controls their grants cover`,
		[visitor(role)],
		function* ({ buttons, requests, visit }) {
			yield* visit("/controls");

			yield* outcomes({
				buttons: [buttons(), [...shown]],
				requests: [requests(), []],
			});
		},
	);
}

permissionScreens.it(
	"the permission fallback renders a Forbidden from a loader's RPC",
	[visitor("reader", "guest")],
	function* ({ heading, location, requests, visit }) {
		yield* visit("/notes/first");

		yield* outcomes({
			heading: [heading(), "Permission denied"],
			location: [location(), "/notes/first"],
			requests: [requests(), ["POST /rpc/"]],
		});
	},
);

permissionScreens.it(
	"the permission fallback renders a Forbidden from a component query",
	[visitor("guest")],
	function* ({ heading, requests, visit }) {
		yield* visit("/query");

		yield* outcomes({
			heading: [heading(), "Permission denied"],
			requests: [requests(), ["POST /rpc/"]],
		});
	},
);

permissionScreens.it("an unrelated query failure reaches the application's error boundary", [visitor("reader")], function* ({ heading, visit }) {
	yield* visit("/notes/offline");

	expect(yield* heading()).toBe("Application unavailable");
});

permissionScreens.it(
	"an explicit sign-out lands on sign-in without a return target",
	[visited("reader", "/notes/first?tab=history")],
	function* ({ heading, location, signOut }) {
		yield* signOut();

		yield* outcomes({
			heading: [heading(), "Sign in"],
			location: [location(), "/login"],
		});
	},
);
