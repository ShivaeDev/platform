import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { failingBuild, separateRegistries } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it("fails the upgrade check when the upgraded app's build fails", [unpublishedContract, failingBuild], function* ({ checkUpgraded }) {
	expect(yield* checkUpgraded()).toContain("pnpm run build failed");
});

app.it(
	"refuses a restored app that no longer has the separate registries the upgrade consolidates",
	[unpublishedContract],
	function* ({ crossesRegistryConsolidation }) {
		expect(yield* crossesRegistryConsolidation()).toBe(
			"The upgrade no longer crosses the registry consolidation: the restored app has no src/admin/modules.ts, so the version restoreStarter restores in restore.ts moved past it.",
		);
	},
);

app.it(
	"fails the upgrade check when the upgraded app keeps a separate registry",
	[unpublishedContract, separateRegistries],
	function* ({ checkUpgraded }) {
		expect(yield* checkUpgraded()).toBe("The upgrade kept the obsolete src/admin/modules.ts.");
	},
);
