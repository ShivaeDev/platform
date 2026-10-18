import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"changes saved theme and density and pauses native updates from the header settings",
	[headerScreen(0, true)],
	function* ({ click, choose, control, findElement, keyboard, readFocus, readRootAttribute, readPaused }) {
		expect(findElement('[role="dialog"][aria-label="Settings"]', document)).toBeNull();
		click("#settings-open");
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("theme")));
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
		yield* Effect.promise(() => eventually(() => expect(findElement('[role="dialog"][aria-label="Settings"]', document)).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("settings-open")));
	},
);
