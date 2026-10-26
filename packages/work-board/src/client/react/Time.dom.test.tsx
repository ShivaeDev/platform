import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { TIME_NOW, timeScreen } from "#test/timeScreen.tsx";
import { exactTime } from "./timeLabel.ts";

expectNoReactWarnings();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const relative = new Intl.RelativeTimeFormat(undefined, { style: "narrow" });
const shortDate = { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" } as const;

screenStory.it(
	"ticks mounted times and updates a refreshed timestamp without replacing its element",
	[timeScreen()],
	function* ({ advanceTime, refreshTime, findElement, readText }) {
		const time = findElement("time");
		expect(readText("time")).toBe("just now");
		yield* Effect.promise(() => advanceTime(MINUTE));
		expect(readText("time")).toBe(relative.format(-1, "minute"));
		yield* Effect.promise(() => refreshTime(HOUR));
		expect(findElement("time")).toBe(time);
		expect(readText("time")).toBe(relative.format(-1, "hour"));
	},
);

for (const [name, ago, label] of [
	["under a minute", 59_000, "just now"],
	["under five minutes", 4 * MINUTE + 59_000, relative.format(-4, "minute")],
	["under an hour", 59 * MINUTE, relative.format(-59, "minute")],
	["under a day", DAY - MINUTE, relative.format(-23, "hour")],
	["a few days old", 3 * DAY, relative.format(-3, "day")],
	["just under a week old", 7 * DAY - 1, relative.format(-6, "day")],
	["two hours ahead", -2 * HOUR, relative.format(2, "hour")],
	["a week old", 7 * DAY, new Intl.DateTimeFormat(undefined, shortDate).format(TIME_NOW.getTime() - 7 * DAY)],
	["more than a week ahead", -8 * DAY, new Intl.DateTimeFormat(undefined, shortDate).format(TIME_NOW.getTime() + 8 * DAY)],
	["from last year", 400 * DAY, new Intl.DateTimeFormat(undefined, { ...shortDate, year: "numeric" }).format(TIME_NOW.getTime() - 400 * DAY)],
] as const) {
	screenStory.it(`reads a time ${name} as ${label}`, [timeScreen(ago)], ({ findElement }) => {
		const time = findElement("time");
		expect(time?.textContent).toBe(label);
		expect(time?.getAttribute("datetime")).toBe(new Date(TIME_NOW.getTime() - ago).toISOString());
		expect(time?.closest("button")?.className).toContain("font-sans");
	});
}

for (const [reach, open] of [
	["points at", "hover"],
	["taps", "tap"],
	["focuses and activates", "keyboard"],
] as const) {
	screenStory.it(
		`shows the exact time when the reader ${reach} it`,
		[timeScreen(3 * HOUR)],
		function* ({ advanceTime, click, findElement, focus, hover, readText, tap }) {
			const time = findElement("time");
			const trigger = time?.closest("button");
			expect(trigger?.tabIndex).toBe(0);
			if (open === "hover") {
				yield* Effect.promise(() => hover(trigger));
			} else if (open === "tap") {
				yield* Effect.promise(() => tap(trigger));
			} else {
				focus(trigger);
				expect(document.activeElement).toBe(trigger);
				click(trigger);
			}
			yield* Effect.promise(() => advanceTime(1000));
			expect(readText("[data-slot=popover-content]", document)).toBe(exactTime(TIME_NOW.getTime() - 3 * HOUR));
		},
	);
}

screenStory.it(
	"keeps a time in a list row as plain text that adds no Tab stop and names its exact time",
	[timeScreen(3 * HOUR, "row")],
	({ findElement, readTabStops }) => {
		const time = findElement("time");
		expect(time?.textContent).toBe(relative.format(-3, "hour"));
		expect(time?.getAttribute("datetime")).toBe(new Date(TIME_NOW.getTime() - 3 * HOUR).toISOString());
		expect(time?.className).toContain("font-sans");
		expect(time?.getAttribute("title")).toBe(exactTime(TIME_NOW.getTime() - 3 * HOUR));
		expect(readTabStops(".time-host")).toEqual([]);
	},
);
