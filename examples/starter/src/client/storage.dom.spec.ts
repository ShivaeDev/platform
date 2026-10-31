import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { blockedStorage } from "#test-support/blockedStorage.ts";
import { homeScreen } from "#test-support/homeScreen.tsx";
import { screens } from "#test-support/screens.ts";

for (const operation of ["access", "read"] as const) {
	screens.it(
		`the app mounts with the system theme when storage throws on ${operation}`,
		[blockedStorage(operation), homeScreen],
		function* ({ settle, controlText, themeSelection }) {
			yield* settle();

			yield* outcomes([
				["home page", () => Effect.sync(() => controlText("h1")), "Your app"],
				["theme selection", () => Effect.sync(themeSelection), "system"],
			]);
		},
	);
}

for (const operation of ["access", "write"] as const) {
	screens.it(
		`a theme choice still applies when storage throws on ${operation}`,
		[blockedStorage(operation), homeScreen],
		function* ({ chooseTheme, themeAppearance, themeSelection }) {
			expect(themeAppearance()).toBe("light");

			yield* chooseTheme("dark");

			yield* outcomes([
				["theme selection", () => Effect.sync(themeSelection), "dark"],
				["appearance", () => Effect.sync(themeAppearance), "dark"],
			]);
		},
	);
}
