import { expect } from "vitest";
import { INITIAL_THEME_SCRIPT } from "#server/page/initialTheme.ts";
import { blockedStorage, screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

const workspace = screenWorkspace("initial-appearance");

for (const [saved, system, scheme] of [
	['{"theme":"dark"}', "light", "dark"],
	['{"theme":"light"}', "dark", "light"],
	['{"theme":"system"}', "dark", "dark"],
	["{}", "light", "light"],
	['{"theme":"other"}', "dark", "dark"],
	["null", "dark", "dark"],
	["invalid", "dark", "dark"],
	[undefined, "dark", "dark"],
] as const) {
	screenStory.it(
		`${saved === undefined ? "with storage blocked" : `with ${saved} saved`} and a ${system} system, the shell applies the ${scheme} scheme before React starts`,
		[
			workspace,
			screenMedia(system === "dark" ? ["(prefers-color-scheme: dark)"] : []),
			saved === undefined ? blockedStorage() : storedScreenState({ "work-board:appearance:initial-appearance": saved }),
		],
		function* ({ appliedScheme, initializeAppearance }) {
			yield* initializeAppearance(INITIAL_THEME_SCRIPT);

			expect(yield* appliedScheme()).toBe(scheme);
		},
	);
}

for (const [saved, sidebar] of [
	['{"closed":true}', "closed"],
	['{"closed":false}', "open"],
	['{"closed":"yes"}', "open"],
] as const) {
	screenStory.it(
		`with ${saved} saved, the shell outlines the ${sidebar} sidebar before React starts`,
		[workspace, storedScreenState({ "work-board:appearance:initial-appearance": saved })],
		function* ({ initializeAppearance, outlinedSidebar }) {
			yield* initializeAppearance(INITIAL_THEME_SCRIPT);

			expect(yield* outlinedSidebar()).toBe(sidebar);
		},
	);
}
