import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { newYork, preferences } from "#test/account-preferences/story.ts";

preferences.it("alice edits timezone, locale and units through the preference contract", [newYork], function* ({ get, set }) {
	expect(yield* get()).toEqual({ locale: "en-US", timezone: "America/New_York", units: "imperial" });

	yield* set({ locale: "de-DE", timezone: "Europe/Berlin", units: "metric" });

	expect(yield* get()).toEqual({ locale: "de-DE", timezone: "Europe/Berlin", units: "metric" });
});

preferences.it("a later browser capture preserves alice's edited preferences", [newYork], function* ({ capture, get }) {
	yield* capture({ locale: "fr-FR", timezone: "Europe/Paris", units: "metric" });

	expect(yield* get()).toEqual({ locale: "en-US", timezone: "America/New_York", units: "imperial" });
});

preferences.it("alice's saved preferences leave bob's defaults unchanged", [], function* ({ set, get }) {
	yield* set({ locale: "ja-JP", timezone: "Asia/Tokyo", units: "metric" });

	yield* outcomes([
		["alice's preferences", () => get("alice"), { locale: "ja-JP", timezone: "Asia/Tokyo", units: "metric" }],
		["bob's defaults", () => get("bob"), { locale: "en", timezone: "UTC", units: "metric" }],
	]);
});

preferences.it("an unsigned caller cannot read account preferences", [], function* ({ unsignedGet }) {
	expect(yield* unsignedGet()).toBe("failed with unauthorized");
});
