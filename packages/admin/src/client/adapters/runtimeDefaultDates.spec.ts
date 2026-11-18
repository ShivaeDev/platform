import { expect } from "vitest";
import { runtimeDates, runtimeDefaults } from "#test/runtimeDates.ts";

const SIGNED_UP = "2026-10-20T12:34:56.789Z";

for (const [locale, expected] of [
	["de-DE", "20.10.2026, 21:34:56 GMT+9"],
	["ja-JP", "2026/10/20 21:34:56 JST"],
] as const) {
	runtimeDates.it(
		`given no locale, a runtime whose own locale is ${locale} writes 12:34:56 UTC on 20 October 2026 for Asia/Tokyo as ${expected}`,
		[runtimeDefaults(locale, "UTC")],
		function* ({ written }) {
			expect(yield* written(SIGNED_UP, { timeZone: "Asia/Tokyo" })).toBe(expected);
		},
	);
}

for (const [locale, timeZone, expected] of [
	["de-DE", "Asia/Tokyo", "20.10.2026, 21:34:56 GMT+9"],
	["ja-JP", "Europe/Berlin", "2026/10/20 14:34:56 GMT+2"],
] as const) {
	runtimeDates.it(
		`given neither a locale nor a time zone, a runtime whose own are ${locale} and ${timeZone} writes 12:34:56 UTC on 20 October 2026 as ${expected}`,
		[runtimeDefaults(locale, timeZone)],
		function* ({ written }) {
			expect(yield* written(SIGNED_UP, {})).toBe(expected);
		},
	);
}
