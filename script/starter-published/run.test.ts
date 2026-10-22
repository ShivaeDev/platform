import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { failingCi } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"runs the installed app's own CI script with its working directory and PostgreSQL URL",
	[unpublishedContract],
	function* ({ run, ciResult, directory, database }) {
		expect(yield* run()).toBeUndefined();
		expect(JSON.parse(yield* ciResult())).toEqual({ cwd: directory, database, query: 42 });
	},
);

app.it("fails the published-starter check when the installed app's CI script fails", [unpublishedContract, failingCi], function* ({ run }) {
	expect(yield* run()).toContain("Generated app: pnpm run ci failed (exit 1)");
});
