import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authenticationOffline, loginScreen, screens } from "#modules/notes/test-support/screens.ts";

for (const mode of ["sign-up", "sign-in"] as const) {
	screens.it(
		`an accepted ${mode} sends alice's details and authenticates her`,
		[loginScreen()],
		function* ({ authenticated, authenticationCalls, settle, submitsCredentials }) {
			expect(yield* authenticated()).toBe("not authenticated");

			yield* submitsCredentials(mode);
			yield* settle();

			yield* outcomes([
				["authentication", authenticated, `authenticated by ${mode}`],
				[
					"provider calls",
					authenticationCalls,
					[{ credentials: { email: "alice@app.test", password: "correct-horse", ...(mode === "sign-up" ? { name: "Alice" } : {}) }, mode }],
				],
			]);
		},
	);
}

screens.it(
	"a refused sign-up shows the provider's reason and keeps alice's email",
	[loginScreen("Email is already registered")],
	function* ({ alert, authenticated, draft, settle, submitsCredentials }) {
		yield* submitsCredentials("sign-up");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Email is already registered"],
			["email", () => draft("Email"), "alice@app.test"],
			["authentication", authenticated, "not authenticated"],
		]);
	},
);

screens.it(
	"an unreachable provider asks alice to try signing in again",
	[authenticationOffline(), loginScreen()],
	function* ({ alert, authenticated, settle, submitsCredentials }) {
		yield* submitsCredentials("sign-in");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Could not reach authentication. Try again."],
			["authentication", authenticated, "not authenticated"],
		]);
	},
);
