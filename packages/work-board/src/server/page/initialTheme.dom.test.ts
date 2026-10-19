import { expect } from "vitest";
import { INITIAL_THEME_SCRIPT } from "#server/page/initialTheme.ts";
import { blockedStorage, screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

for (const [saved, system, expected] of [
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
		`initializes saved ${saved} with system ${system} before React`,
		[
			screenWorkspace("initial-appearance"),
			screenMedia(system === "dark" ? ["(prefers-color-scheme: dark)"] : []),
			saved === undefined ? blockedStorage() : storedScreenState({ "work-board:appearance:initial-appearance": saved }),
		],
		({ initializeAppearance, readRootAttribute }) => {
			initializeAppearance(INITIAL_THEME_SCRIPT);
			expect(readRootAttribute("data-scheme")).toBe(expected);
			expect(document.documentElement.classList.contains("dark")).toBe(expected === "dark");
		},
	);
}

for (const [saved, sidebar] of [
	['{"closed":true}', "closed"],
	['{"closed":false}', "open"],
	['{"closed":"yes"}', "open"],
] as const) {
	screenStory.it(
		`outlines the ${sidebar} sidebar before React when the reader saved ${saved}`,
		[screenWorkspace("initial-appearance"), storedScreenState({ "work-board:appearance:initial-appearance": saved })],
		({ initializeAppearance, readRootAttribute }) => {
			initializeAppearance(INITIAL_THEME_SCRIPT);
			expect(readRootAttribute("data-sidebar")).toBe(sidebar);
		},
	);
}
