import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"changes saved theme and density with toggle groups and pauses native updates from the header settings",
	[headerScreen(0, true)],
	function* ({ click, control, findElements, keyboard, readFocus, readRootAttribute, readPaused, roles }) {
		const settings = { name: "Settings", role: "dialog" } as const;
		const pressed = () => findElements('[role="group"] [aria-pressed="true"]', document).map((found) => roles.accessible(found).name);
		expect(() => roles.text(settings)).toThrow(/has 0 matches/u);
		yield* roles.click({ name: "Settings", role: "button" });
		expect(roles.text({ name: "Theme", role: "group" })).toContain("System");
		expect(roles.text({ name: "Density", role: "group" })).toContain("Compact");
		yield* Effect.promise(() => eventually(() => expect(roles.accessible(readFocus() ?? document.body)).toEqual({ name: "System", role: "button" })));
		expect(pressed()).toEqual(["System", "Comfortable"]);
		yield* roles.click({ name: "Dark", role: "button" });
		yield* roles.click({ name: "Compact", role: "button" });
		expect(pressed()).toEqual(["Dark", "Compact"]);
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(true);
		expect(readRootAttribute("data-density")).toBe("compact");
		click("#updates-toggle");
		expect(control("#updates-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		expect(readPaused()).toBe(true);
		expect(control("#updates-toggle", HTMLButtonElement).textContent).toBe("Resume updates");
		yield* roles.click({ name: "Light", role: "button" });
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(false);
		yield* roles.click({ name: "Light", role: "button" });
		expect(pressed()).toEqual(["Light", "Compact"]);
		keyboard("Escape", {}, document);
		yield* Effect.promise(() => eventually(() => expect(() => roles.text(settings)).toThrow(/has 0 matches/u)));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("settings-open")));
	},
);
