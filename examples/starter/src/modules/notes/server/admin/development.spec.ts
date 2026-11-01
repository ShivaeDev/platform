import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost, adminThroughDevelopmentServer } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"through the development server, every admin route serves the app shell",
	[adminThroughDevelopmentServer()],
	function* ({ servesAppShell }) {
		const admin = yield* servesAppShell("/admin");

		yield* outcomes([
			["/admin", () => Effect.succeed(admin), "the app shell"],
			["/admin/jobs", () => servesAppShell("/admin/jobs"), "the app shell"],
			["/admin/notes", () => servesAppShell("/admin/notes"), "the app shell"],
			["/admin/users", () => servesAppShell("/admin/users"), "the app shell"],
		]);
	},
);

const refusedReaders = [
	["reader", [adminAccount("reader"), adminThroughDevelopmentServer()], "permission denied"],
	["visitor", [adminThroughDevelopmentServer()], "sign in required"],
] as const;

for (const [name, traits, refused] of refusedReaders) {
	adminHost.it(
		`through the development server, the word-count queue, notes statistics and users answer ${name} with ${refused}`,
		traits,
		function* ({ noteStatistics, users, wordCountQueue }) {
			const queue = yield* wordCountQueue(name);

			yield* outcomes([
				["word-count queue", () => Effect.succeed(queue), refused],
				["notes statistics", () => noteStatistics(name), refused],
				["users", () => users(name), refused],
			]);
		},
	);
}

adminHost.it(
	"through the development server, an admin reads the users, notes statistics and word-count queue",
	[adminAccount("reader"), adminAccount("operator", "admin"), adminThroughDevelopmentServer()],
	function* ({ createsNote, noteStatistics, users, wordCountQueue }) {
		expect(yield* wordCountQueue("operator")).toEqual({ queued: 0, total: 0 });

		yield* createsNote("reader", "Waiting for word count");

		yield* outcomes([
			[
				"users",
				() => users("operator"),
				{
					users: [
						{ email: "operator@app.test", role: "admin" },
						{ email: "reader@app.test", role: "user" },
					],
				},
			],
			["notes statistics", () => noteStatistics("operator"), { notes: 1, pending: 1, words: 0 }],
			["word-count queue", () => wordCountQueue("operator"), { queued: 1, total: 1 }],
		]);
	},
);
