import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fullScreenShellScreen, moduleShellScreen } from "#test-support/moduleShellScreen.tsx";
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

const MAIN_NAVIGATION = 'nav[aria-label="Main"]';
const OVERLAYS = ["First overlay", "First second overlay", "Second overlay", "Second second overlay"];

for (const [path, route, title] of [
	["/timer", "a route that declares fullScreen", "Timer"],
	["/workout", "a route under a parent that declares fullScreen", "Workout"],
] as const) {
	screens.it(
		`${route} renders with the overlays and without the Main navigation and footer`,
		[fullScreenShellScreen(path)],
		function* ({ controlTexts, heading, settle, shown }) {
			yield* settle();

			yield* outcomes([
				["Main navigation", () => shown(MAIN_NAVIGATION), "hidden"],
				["footer", () => shown("footer"), "hidden"],
				["overlays", () => controlTexts("aside"), OVERLAYS],
				["route", () => heading(), title],
			]);
		},
	);
}

screens.it(
	"leaving a full-screen route brings the Main navigation and footer back",
	[fullScreenShellScreen("/workout")],
	function* ({ clickControl, controlTexts, heading, settle, shown }) {
		yield* settle();
		yield* outcomes([
			["Main navigation", () => shown(MAIN_NAVIGATION), "hidden"],
			["footer", () => shown("footer"), "hidden"],
		]);

		yield* clickControl("a");
		yield* settle();

		yield* outcomes([
			["menu entries", () => controlTexts(`${MAIN_NAVIGATION} a`), ["First menu", "First sign-in", "Second menu", "Second sign-in"]],
			["footer", () => controlTexts("footer p"), ["First footer", "Second footer"]],
			["route", () => heading(), "Module home"],
		]);
	},
);

screens.it(
	"a full-screen route shows the loading line, still without the Main navigation and footer, while the route its link opens loads",
	[fullScreenShellScreen("/workout", "/")],
	function* ({ clickControl, controlTexts, heading, settle, shown }) {
		yield* settle();
		expect(yield* controlTexts("[role=status]")).toEqual([]);

		yield* clickControl("a");
		yield* settle();

		yield* outcomes([
			["loading line", () => controlTexts("[role=status]"), ["Loading…"]],
			["Main navigation", () => shown(MAIN_NAVIGATION), "hidden"],
			["footer", () => shown("footer"), "hidden"],
			["route", () => heading(), "Workout"],
		]);
	},
);

screens.it(
	"a full-screen route that is still loading when the app opens shows the loading line without the Main navigation and footer",
	[fullScreenShellScreen("/timer", "/timer")],
	function* ({ controlTexts, settle, shown }) {
		yield* settle();

		yield* outcomes([
			["loading line", () => controlTexts("[role=status]"), ["Loading…"]],
			["Main navigation", () => shown(MAIN_NAVIGATION), "hidden"],
			["footer", () => shown("footer"), "hidden"],
		]);
	},
);
