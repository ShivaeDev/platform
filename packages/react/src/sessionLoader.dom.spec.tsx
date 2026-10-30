import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { privateLoadWaiting, sessionLoaders, unauthorizedLoad } from "#test/sessionLoaderStories.tsx";

for (const mode of ["route", "direct"] as const) {
	sessionLoaders.it(
		`a ${mode} load failing as Unauthorized shows Session expired and asks the auth owner to recheck once`,
		[privateLoadWaiting(mode, "Unauthorized")],
		function* ({ alert, failLoad, rechecks }) {
			yield* failLoad("Unauthorized");

			yield* outcomes({
				alert: [alert(), "Session expired"],
				rechecks: [rechecks(), ["visitor"]],
			});
		},
	);

	sessionLoaders.it(
		`applying the auth owner's verdict after a ${mode} Unauthorized load ends the session without another recheck`,
		[unauthorizedLoad(mode)],
		function* ({ applySession, rechecks, screenText }) {
			yield* applySession();

			yield* outcomes({
				rechecks: [rechecks(), ["visitor"]],
				screen: [screenText(), "Session ended"],
			});
		},
	);

	sessionLoaders.it(
		`a ${mode} load failing as Unavailable shows Load unavailable and asks for no recheck`,
		[privateLoadWaiting(mode, "Unavailable")],
		function* ({ alert, failLoad, rechecks }) {
			yield* failLoad("Unavailable");

			yield* outcomes({
				alert: [alert(), "Load unavailable"],
				rechecks: [rechecks(), []],
			});
		},
	);
}

sessionLoaders.it(
	"after an Unauthorized route load, following the sign-in redirect stays on the signed-out sign-in screen",
	[unauthorizedLoad("route")],
	function* ({ screenText, signIn }) {
		yield* signIn();

		expect(yield* screenText()).toContain("Signed out: sign in");
	},
);
