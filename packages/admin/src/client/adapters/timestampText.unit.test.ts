import { DateTime } from "effect";
import { expect, it } from "vitest";
import { timestampText } from "#client/adapters/timestampText.ts";

const signedUp = DateTime.makeUnsafe("2026-10-20T12:34:56.789Z");

it.each([
	["en-GB", "Europe/Berlin", "20 Oct 2026, 14:34:56 CEST"],
	["de-DE", "Europe/Berlin", "20.10.2026, 14:34:56 MESZ"],
	["en-GB", "Asia/Tokyo", "20 Oct 2026, 21:34:56 GMT+9"],
] as const)("writes 12:34:56 UTC on 20 October 2026 for locale %s in %s as %s", (locale, timeZone, expected) => {
	expect(timestampText(signedUp, { locale, timeZone })).toBe(expected);
});

it("without a locale, writes the time as it does for the runtime's own locale", () => {
	const runtimeLocale = new Intl.DateTimeFormat().resolvedOptions().locale;

	expect(timestampText(signedUp, { timeZone: "Asia/Tokyo" })).toBe(timestampText(signedUp, { locale: runtimeLocale, timeZone: "Asia/Tokyo" }));
});

it("without a time zone, writes the time as it does for the runtime's own time zone", () => {
	const runtimeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

	expect(timestampText(signedUp, { locale: "en-GB" })).toBe(timestampText(signedUp, { locale: "en-GB", timeZone: runtimeZone }));
});

it.each([
	["a locale", { locale: "en_US", timeZone: "Asia/Tokyo" }],
	["a time zone", { locale: "de-DE", timeZone: "Mars/Olympus" }],
] as const)("%s that Intl cannot read falls back to the runtime's locale and time zone", (_, dates) => {
	expect(timestampText(signedUp, dates)).toBe(timestampText(signedUp, {}));
});
