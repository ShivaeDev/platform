import { expect } from "vitest";
import { columnKey, definedModulesHost, servedByWorkerHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"an operation the host serves seals a provider token with the key the host reads from COLUMN_ENCRYPTION_KEY and opens it again",
	[],
	function* ({ readProviderToken, storeProviderToken }) {
		const id = yield* storeProviderToken("withings-refresh-a");

		expect(yield* readProviderToken(Number(id))).toBe("withings-refresh-a");
	},
);

const refusals = [
	{ configured: "missing", refusal: "COLUMN_ENCRYPTION_KEY is not set; encrypted fields need it to hold 32 random bytes in base64" },
	{ configured: "16 random bytes in base64", refusal: "COLUMN_ENCRYPTION_KEY must hold exactly 32 bytes in base64" },
] as const;

for (const { configured, refusal } of refusals) {
	definedModulesHost.it(
		`an app host whose models declare an encrypted field refuses to start when COLUMN_ENCRYPTION_KEY is ${configured}`,
		[columnKey(configured)],
		function* ({ startup }) {
			expect(yield* startup()).toBe(refusal);
		},
	);
}

definedModulesHost.it(
	"a worker host whose models declare an encrypted field refuses to start when COLUMN_ENCRYPTION_KEY is missing",
	[columnKey("missing"), servedByWorkerHost],
	function* ({ startup }) {
		expect(yield* startup()).toBe(refusals[0].refusal);
	},
);
