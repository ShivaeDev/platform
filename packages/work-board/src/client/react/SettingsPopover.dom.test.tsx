import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"changes saved theme and density with toggle groups and pauses native updates from the header settings",
	[headerScreen(0, true)],
	function* ({ click, control, findByRole, keyboard, readFocus, readRootAttribute, readPaused }) {
		expect(findByRole("dialog", "Settings", document)).toBeNull();
		click(findByRole("button", "Settings"));
		const theme = findByRole("group", "Theme", document);
		const density = findByRole("group", "Density", document);
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(findByRole("button", "System", theme))));
		expect(findByRole("button", "System", theme)?.getAttribute("aria-pressed")).toBe("true");
		click(findByRole("button", "Dark", theme));
		click(findByRole("button", "Compact", density));
		expect(findByRole("button", "Dark", theme)?.getAttribute("aria-pressed")).toBe("true");
		expect(findByRole("button", "System", theme)?.getAttribute("aria-pressed")).toBe("false");
		expect(findByRole("button", "Compact", density)?.getAttribute("aria-pressed")).toBe("true");
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(true);
		expect(readRootAttribute("data-density")).toBe("compact");
		click("#updates-toggle");
		expect(control("#updates-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		expect(readPaused()).toBe(true);
		expect(control("#updates-toggle", HTMLButtonElement).textContent).toBe("Resume updates");
		click(findByRole("button", "Light", theme));
		expect(readRootAttribute("class")?.split(" ").includes("dark") ?? false).toBe(false);
		click(findByRole("button", "Light", theme));
		expect(findByRole("button", "Light", theme)?.getAttribute("aria-pressed")).toBe("true");
		keyboard("Escape", {}, document);
		yield* Effect.promise(() => eventually(() => expect(findByRole("dialog", "Settings", document)).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("settings-open")));
	},
);
