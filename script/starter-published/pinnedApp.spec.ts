import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	effectCatalogUpdate,
	effectPeerMismatch,
	hostileRegistryEnvironment,
	pendingChangeset,
	pinnedApp,
	unreleasedPin,
} from "#starter-published/test-support/pinnedApp.ts";

pinnedApp.it("Packed starter rejects tooling incompatible with its published pin even when the workspace accepts it", [], function* ({ check }) {
	expect(yield* check()).toContain("Expected 2 arguments, but got 3");
});

pinnedApp.it(
	"Packed starter looks pins up in its fixture registry when the environment names another registry",
	[hostileRegistryEnvironment],
	function* ({ check }) {
		expect(yield* check()).toContain("Expected 2 arguments, but got 3");
	},
);

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
	function* ({ check, installedUnrelated, recordedSources }) {
		yield* outcomes([
			["generated app CI", () => check(), "passed"],
			[
				"recorded sources",
				() => recordedSources(),
				[
					"Installing @fixture/local-postgres@1.0.0 from the workspace archive because peerDependencies.effect is 4.1.1 here and 4.1.0 on npm.",
					"Installing @fixture/unrelated@1.0.0 from npm because nothing pending releases it and its declarations match npm.",
				],
			],
			["unchanged package source", () => installedUnrelated(), "npm"],
		]);
	},
);

pinnedApp.it("Packed starter accepts an unreleased pin from its matching archive", [unreleasedPin], function* ({ check }) {
	expect(yield* check()).toBe("passed");
});

pinnedApp.it(
	"Packed starter installs a package that a pending changeset releases from its archive, names the changeset, and keeps an unchanged package from npm",
	[pendingChangeset],
	function* ({ check, installedUnrelated, recordedSources }) {
		yield* outcomes([
			["generated app CI", () => check(), "passed"],
			[
				"recorded sources",
				() => recordedSources(),
				[
					"Installing @fixture/local-postgres@1.0.0 from the workspace archive because .changeset/adapter-ports.md releases it (minor).",
					"Installing @fixture/unrelated@1.0.0 from npm because nothing pending releases it and its declarations match npm.",
				],
			],
			["unchanged package source", () => installedUnrelated(), "npm"],
		]);
	},
);
