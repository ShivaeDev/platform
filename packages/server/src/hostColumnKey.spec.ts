import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { columnKeyConfigured, definedModulesHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"an operation the host serves seals a provider token with the key from COLUMN_ENCRYPTION_KEY and opens it again",
	[columnKeyConfigured],
	function* ({ readProviderToken, storeProviderToken }) {
		const id = yield* storeProviderToken("withings-refresh-a");

		expect(yield* readProviderToken(Number(id))).toBe("withings-refresh-a");
	},
);

definedModulesHost.it(
	"without COLUMN_ENCRYPTION_KEY the host starts, and storing a provider token fails with a defect that names the config value",
	[],
	function* ({ loggedDefectMessage, startup, storeProviderToken }) {
		expect(yield* startup()).toBe("started");

		const stored = yield* storeProviderToken("withings-refresh-a");

		yield* outcomes([
			["store answer", () => Effect.succeed(stored), "failed with internal server error"],
			[
				"logged defect",
				() => loggedDefectMessage(),
				'COLUMN_ENCRYPTION_KEY is not set; encrypted fields need it to hold 32 random bytes in base64\n  at ["token"]',
			],
		]);
	},
);
