import { expect } from "vitest";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"changes saved theme and density and pauses native updates from the header settings",
	[headerScreen(0, true)],
	({ click, choose, control, keyboard, readFocus, readRootAttribute, readPaused }) => {
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(true);
		click("#settings-open");
		expect(readFocus()?.id).toBe("theme");
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(false);
		choose("#theme", "dark");
		choose("#density", "compact");
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(true);
		expect(readRootAttribute("data-density")).toBe("compact");
		click("#updates-toggle");
		expect(control("#updates-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		expect(readPaused()).toBe(true);
		expect(control("#updates-toggle", HTMLButtonElement).textContent).toBe("Resume updates");
		choose("#theme", "light");
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(false);
		keyboard("Escape", { bubbles: true }, document);
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(true);
		expect(readFocus()?.id).toBe("settings-open");
	},
);
