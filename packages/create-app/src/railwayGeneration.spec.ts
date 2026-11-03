import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";

for (const flags of [[], ["--minimal"]] as const) {
	application.it(
		`a generated ${flags.length === 0 ? "notes" : "minimal"} app's Railway shared variables agree with its deployment README, including email`,
		[],
		function* ({ createApp, documentedRailwayVariables, railwaySharedVariables }) {
			yield* createApp("demo", "--no-git", ...flags);

			const documented = yield* documentedRailwayVariables();
			yield* outcomes([
				[
					"documented email settings",
					() => documentedRailwayVariables(),
					{ worker: expect.arrayContaining(["EMAIL_FROM", "PUBLIC_URL", "RESEND_API_KEY"]) },
				],
				["Railway shared variables", () => railwaySharedVariables(), documented],
			]);
		},
	);
}

application.it("a generated app no longer carries a separate Railway proxy file", [], function* ({ createApp, exists }) {
	yield* createApp("demo", "--no-git");

	expect(yield* exists(".railway/proxy.json")).toBe(false);
});
