import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { openedAt, sessionApps } from "#test/session-app/story.tsx";

sessionApps.it("a signed-out visitor reads a public route through the signed-out connection", [openedAt("/count")], function* ({ count, heading }) {
	yield* outcomes([
		["heading", () => heading(), "Count"],
		["count", () => count(), "3"],
	]);
});

sessionApps.it(
	"a signed-out visitor to a signed-in route is sent to sign-in with the requested location to return to",
	[openedAt("/notes?tab=recent#latest")],
	function* ({ heading, path, returnTo }) {
		yield* outcomes([
			["heading", () => heading(), "Sign in"],
			["path", () => path(), "/sign-in"],
			["return to", () => returnTo(), "/notes?tab=recent#latest"],
		]);
	},
);

sessionApps.it(
	"signing in returns to the requested location, where the route reads the new session",
	[openedAt("/notes?tab=recent#latest")],
	function* ({ heading, location, signIn }) {
		yield* signIn();

		yield* outcomes([
			["heading", () => heading(), "Notes for alice"],
			["location", () => location(), "/notes?tab=recent#latest"],
		]);
	},
);

sessionApps.it(
	"a signed-in viewer follows the home page's link to a signed-in route",
	[openedAt("/", "alice")],
	function* ({ follow, heading, path }) {
		expect(yield* heading()).toBe("Home");

		yield* follow("Notes");

		yield* outcomes([
			["heading", () => heading(), "Notes for alice"],
			["path", () => path(), "/notes"],
		]);
	},
);

for (const path of ["/admin/reports", "/admin/reports/7"]) {
	sessionApps.it(
		`a viewer without the admin page's permission is refused at ${path}`,
		[openedAt(path, "alice", true)],
		function* ({ heading, location }) {
			yield* outcomes([
				["heading", () => heading(), "Refused"],
				["location", () => location(), path],
			]);
		},
	);
}

sessionApps.it(
	"a viewer with the admin page's permission opens its detail route",
	[openedAt("/admin/reports/7", "alice, who may read reports")],
	function* ({ heading }) {
		expect(yield* heading()).toBe("Report");
	},
);
