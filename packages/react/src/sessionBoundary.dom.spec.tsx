import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionBoundaryScreens, visitorAt } from "#test/session-boundary/story.tsx";

const TARGET = "/private?tab=history#details";

for (const browserHistory of [false, true]) {
	sessionBoundaryScreens.it(
		`a visitor asks for a protected address, signs in and reaches it after the signed-out router unmounts (${browserHistory ? "browser" : "memory"} history)`,
		[visitorAt(TARGET, { browserHistory })],
		function* ({ heading, href, signIn }) {
			yield* outcomes([
				["screen", () => heading(), "Sign in"],
				["return address", () => Effect.map(href(), (address) => new URL(address, "http://app.test").searchParams.get("returnTo")), TARGET],
			]);

			yield* signIn();

			yield* outcomes([
				["address", () => href(), TARGET],
				["screen", () => heading(), `Signed in at ${TARGET}`],
			]);
		},
	);
}

for (const target of [
	"https://elsewhere.test/private",
	"//elsewhere.test/private",
	"/\\elsewhere.test/private",
	"javascript:alert(1)",
	"http://[",
	"///elsewhere.test/private",
	`${window.location.origin}//elsewhere.test/private`,
	`blob:${window.location.origin}/token`,
]) {
	sessionBoundaryScreens.it(
		`signing in refuses the unsafe continuation ${target} and opens home`,
		[visitorAt(`/sign-in?returnTo=${encodeURIComponent(target)}`)],
		function* ({ heading, href, signIn }) {
			yield* signIn();

			yield* outcomes([
				["address", () => href(), "/"],
				["screen", () => heading(), "Signed in at /"],
			]);
		},
	);
}

for (const sessionIdentity of [false, true]) {
	sessionBoundaryScreens.it(
		sessionIdentity
			? "an explicit session id identity resets screen state on password change"
			: "user id identity keeps signed-in screen state on password change",
		[visitorAt("/private", { sessionIdentity, signedIn: true })],
		function* ({ changePassword, count, displayedCount, heading }) {
			yield* count();
			expect(yield* displayedCount()).toBe("1");

			yield* changePassword();

			yield* outcomes([
				["count", () => displayedCount(), sessionIdentity ? "0" : "1"],
				["screen", () => heading(), "Signed in at /private"],
			]);
		},
	);
}

sessionBoundaryScreens.it(
	"a same-origin absolute continuation opens its local path",
	[visitorAt(`/sign-in?returnTo=${encodeURIComponent(`${window.location.origin}/private?tab=history#details`)}`)],
	function* ({ heading, href, signIn }) {
		yield* signIn();

		yield* outcomes([
			["address", () => href(), "/private?tab=history#details"],
			["screen", () => heading(), "Signed in at /private?tab=history#details"],
		]);
	},
);
