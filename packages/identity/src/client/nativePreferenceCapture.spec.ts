import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { capturesPreferences, deviceIn, nativeSessions, passwordAccount } from "#test/native-sessions/story.ts";

nativeSessions.it(
	"alice's sign-in from a bundled shell with the preferences plugin passes its auth preflight and captures the device's timezone and locale",
	[capturesPreferences, deviceIn("Asia/Tokyo"), passwordAccount("alice")],
	function* ({ deviceLocale, shellPreflight, shellSignsIn, storedPreferences }) {
		const locale = yield* deviceLocale();
		expect(yield* storedPreferences("alice")).toEqual({ locale: "en", timezone: "UTC", units: "metric" });

		yield* shellSignsIn("alice");

		yield* outcomes([
			[
				"sign-in preflight",
				() => shellPreflight("/api/auth/sign-in/email"),
				"granted for content-type, x-platform-account-locale, x-platform-account-timezone",
			],
			["alice's stored preferences", () => storedPreferences("alice"), { locale, timezone: "Asia/Tokyo", units: "metric" }],
		]);
	},
);
