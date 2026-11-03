import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { moduleShellScreen } from "#test-support/moduleShellScreen.tsx";
import { screens } from "#test-support/screens.ts";

screens.it(
	"the shell keeps the module route and renders menu entries, overlays and footers in module order",
	[moduleShellScreen(true)],
	function* ({ controlTexts, heading, settle }) {
		yield* settle();

		yield* outcomes([
			["menu entries", () => controlTexts('nav[aria-label="Main"] a'), ["First menu", "First sign-in", "Second menu", "Second sign-in"]],
			["overlays", () => controlTexts("aside"), ["First overlay", "First second overlay", "Second overlay", "Second second overlay"]],
			["footer", () => controlTexts("footer p"), ["First footer", "Second footer"]],
			["module route", () => heading(), "Module home"],
		]);
	},
);

screens.it(
	"a module without slots renders its route without menu, overlay or footer content",
	[moduleShellScreen(false)],
	function* ({ screenContent, settle }) {
		yield* settle();

		const screen = yield* screenContent();
		expect(screen.innerHTML).toBe("<h1>Module home</h1>");
	},
);
