import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { failingBuild } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it("fails the upgrade check when the upgraded app's build fails", [unpublishedContract, failingBuild], function* ({ checkUpgraded }) {
	expect(yield* checkUpgraded()).toContain("pnpm run build failed");
});
