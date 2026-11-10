import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectCatalogUpdate, effectPeerMismatch, pinnedApp, unreleasedPin } from "#starter-published/test-support/pinnedApp.ts";

pinnedApp.it("Packed starter rejects tooling incompatible with its published pin even when the workspace accepts it", [], function* ({ check }) {
	expect(yield* check()).toContain("Expected 2 arguments, but got 3");
});

pinnedApp.it(
	"Packed starter rejects npm Effect peers that differ from the starter when the pull request declares the same peers",
	[effectPeerMismatch],
	function* ({ check }) {
		expect(yield* check()).toContain("unmet peer effect");
	},
);

pinnedApp.it(
	"Packed starter installs a package whose peers the pull request moved from its archive, names why, and keeps an unchanged package from npm",
	[effectCatalogUpdate],
	function* ({ archiveInstalls, check, installedUnrelated }) {
		yield* outcomes([
			["generated app CI", () => check(), "passed"],
			[
				"archive installs",
				() => archiveInstalls(),
				["Installing @fixture/local-postgres@1.0.0 from the workspace archive because peerDependencies.effect is 4.1.1 here and 4.1.0 on npm."],
			],
			["unchanged package source", () => installedUnrelated(), "npm"],
		]);
	},
);

pinnedApp.it("Packed starter accepts an unreleased pin from its matching archive", [unreleasedPin], function* ({ check }) {
	expect(yield* check()).toBe("passed");
});
