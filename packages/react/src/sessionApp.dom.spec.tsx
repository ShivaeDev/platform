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
	"a signed-out query that answers Unauthorized asks for one session check, and a signed-out answer does not ask again",
	[openedAt("/diary", undefined, { checkAnswers: "signed out" })],
	function* ({ diary, diaryReads, sessionChecks }) {
		yield* outcomes([
			["diary", () => diary(), "Sign in to read"],
			["session checks", () => sessionChecks(), 1],
			["diary reads", () => diaryReads(), 1],
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

for (const path of ["/admin", "/admin/reports", "/admin/reports/new", "/admin/reports/7"]) {
	sessionApps.it(
		`a viewer without the admin page's permission is refused at ${path}`,
		[openedAt(path, "alice", { caught: "forbidden" })],
		function* ({ heading, location }) {
			yield* outcomes([
				["heading", () => heading(), "Refused"],
				["location", () => location(), path],
			]);
		},
	);
}

for (const [path, shown] of [
	["/admin", "Admin index"],
	["/admin/reports/new", "New report"],
	["/admin/reports/7", "Report"],
] as const) {
	sessionApps.it(`a viewer with the admin page's permission opens ${path}`, [openedAt(path, "alice, who may read reports")], function* ({ heading }) {
		expect(yield* heading()).toBe(shown);
	});
}

sessionApps.it(
	"an unknown path renders the app's not-found page inside its shell",
	[openedAt("/nowhere", undefined, { routing: "its own not-found page" })],
	function* ({ location, shellHeading }) {
		yield* outcomes([
			["heading in the shell", () => shellHeading(), "Page not found"],
			["location", () => location(), "/nowhere"],
		]);
	},
);

sessionApps.it(
	"with refused routes hidden, a viewer without the permission sees the not-found page at the refused route",
	[openedAt("/admin/reports", "alice", { routing: "refused routes hidden behind its not-found page" })],
	function* ({ location, shellHeading }) {
		yield* outcomes([
			["heading in the shell", () => shellHeading(), "Page not found"],
			["location", () => location(), "/admin/reports"],
		]);
	},
);

sessionApps.it(
	"a route's error reaches the app's error report once, beside the route's error screen",
	[openedAt("/broken", undefined, { caught: "a broken screen", routing: "route errors reported to the app" })],
	function* ({ caughtByApp, heading }) {
		yield* outcomes([
			["heading", () => heading(), "Broken"],
			["reported errors", () => caughtByApp(), ["Broken screen"]],
		]);
	},
);
