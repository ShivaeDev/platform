import { Duration } from "effect";
import { expect, it } from "vitest";
import { timeLeftText } from "#client/timeLeftText.ts";

it.each([
	["fifteen minutes", Duration.minutes(15), "15m left"],
	["a minute and a half", Duration.seconds(90), "1m 30s left"],
	["a fraction of a second, rounded up", Duration.millis(200), "1s left"],
	["nothing", Duration.zero, "past deadline"],
	["a negative time, once the deadline has passed", Duration.seconds(-5), "past deadline"],
] as const)("writes %s left as %s", (_, timeLeft, expected) => {
	expect(timeLeftText(timeLeft)).toBe(expected);
});
