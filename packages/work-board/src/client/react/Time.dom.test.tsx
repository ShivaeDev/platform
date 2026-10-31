import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { isoBeforeNow, TIME_NOW, tickingTimeScreen, timeScreen } from "#test/timeScreen.tsx";
import { exactTime } from "./timeLabel.ts";

expectNoReactWarnings();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const relative = new Intl.RelativeTimeFormat(undefined, { style: "narrow" });
const shortDate = { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" } as const;

screenStory.it(
	"A mounted time moves from just now to a minute ago as the runtime clock passes a minute",
	[tickingTimeScreen()],
	function* ({ advanceClock, timeShown }) {
		expect(yield* timeShown()).toEqual(expect.objectContaining({ label: "just now" }));

		yield* advanceClock(MINUTE);

		expect(yield* timeShown()).toEqual(expect.objectContaining({ label: relative.format(-1, "minute") }));
	},
	{ clock: "test" },
);

screenStory.it("A refreshed timestamp reads its new time", [timeScreen()], function* ({ refreshTime, timeShown }) {
	expect(yield* timeShown()).toEqual(expect.objectContaining({ label: "just now" }));

	yield* refreshTime(HOUR);

	expect(yield* timeShown()).toEqual(expect.objectContaining({ datetime: isoBeforeNow(HOUR), label: relative.format(-1, "hour") }));
});

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
	screenStory.it(`A time ${name} reads as ${label}`, [timeScreen(ago)], function* ({ timeShown }) {
		expect(yield* timeShown()).toEqual({ datetime: isoBeforeNow(ago), exact: "on request", label, tabStop: "yes" });
	});
}

for (const how of ["hover", "tap", "keyboard"] as const) {
	screenStory.it(
		`The exact time opens when the reader reaches the time by ${how}`,
		[timeScreen(3 * HOUR)],
		function* ({ exactTimeShown, openExactTime }) {
			expect(yield* exactTimeShown()).toBe("closed");

			yield* openExactTime(how);

			expect(yield* exactTimeShown()).toBe(exactTime(TIME_NOW.getTime() - 3 * HOUR));
		},
	);
}

screenStory.it(
	"A time in a list row is plain text that adds no Tab stop and names its exact time",
	[timeScreen(3 * HOUR, "row")],
	function* ({ timeShown }) {
		expect(yield* timeShown()).toEqual({
			datetime: isoBeforeNow(3 * HOUR),
			exact: exactTime(TIME_NOW.getTime() - 3 * HOUR),
			label: relative.format(-3, "hour"),
			tabStop: "no",
		});
	},
);
