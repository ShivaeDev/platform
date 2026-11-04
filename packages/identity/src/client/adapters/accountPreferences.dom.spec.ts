import { expect } from "vitest";
import { browserPreferences, mintedBrowserSession } from "#test/account-preferences/browserStory.ts";

browserPreferences.it(
	"alice's first browser sign-in captures her timezone and locale with metric units",
	[],
	function* ({ browserDefaults, get, signIn }) {
		const expected = yield* browserDefaults();

		const answer = yield* signIn();

		expect(answer).toBe("signed in");
		expect(yield* get()).toEqual({ ...expected, timezone: "America/New_York" });
	},
);

browserPreferences.it("alice's next browser sign-in preserves her edited timezone, locale and units", [], function* ({ get, setTimezone, signIn }) {
	yield* signIn();
	yield* setTimezone("Pacific/Auckland");
	expect(yield* get()).toEqual({ locale: "en-GB", timezone: "Pacific/Auckland", units: "imperial" });

	yield* signIn();

	expect(yield* get()).toEqual({ locale: "en-GB", timezone: "Pacific/Auckland", units: "imperial" });
});

browserPreferences.it(
	"alice's first browser session read captures preferences after a sign-in without browser headers",
	[mintedBrowserSession],
	function* ({ browserDefaults, get, session }) {
		const expected = yield* browserDefaults();
		expect(yield* get()).toEqual({ locale: "en", timezone: "UTC", units: "metric" });

		const answer = yield* session();

		expect(answer).toBe("alice");
		expect(yield* get()).toEqual({ ...expected, timezone: "America/New_York" });
	},
);
