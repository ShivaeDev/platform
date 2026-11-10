import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	adapterMoved,
	dependentPinned,
	generatorReleased,
	helperDeclared,
	moveChangeset,
	pinnedStarter,
	registryUnavailable,
	releasePin,
} from "#package-check/test-support/pinnedStarter.ts";

for (const workspaceVersion of ["1.0.0", "1.1.0"]) {
	pinnedStarter.it(
		`a published starter pin exposes the incompatible adapter even when workspace ${workspaceVersion} accepts it`,
		[releasePin("1.0.0", workspaceVersion)],
		function* ({ typecheck }) {
			expect(yield* typecheck()).toContain("Expected 2 arguments, but got 3");
		},
	);
}

pinnedStarter.it(
	"an unpublished starter catalog pin typechecks against its matching release archive",
	[releasePin("1.1.0")],
	function* ({ typecheck }) {
		expect(yield* typecheck()).toBeUndefined();
	},
);

pinnedStarter.it("a registry outage fails instead of substituting workspace sources", [registryUnavailable], function* ({ typecheck }) {
	expect(yield* typecheck()).toContain("failed with HTTP 503");
});

pinnedStarter.it(
	"a moved adapter that no pending changeset releases still fails against npm, which names the package unchanged",
	[adapterMoved],
	function* ({ recordedSources, typecheck }) {
		yield* outcomes([
			["typecheck", () => typecheck(), expect.stringContaining("Cannot find module '@fixture/starter-pin/adapters/database'")],
			[
				"recorded sources",
				() => recordedSources(),
				["Installing @fixture/starter-pin@1.0.0 from npm because nothing pending releases it and its declarations match npm."],
			],
		]);
	},
);

pinnedStarter.it(
	"a moved adapter that a pending changeset releases typechecks from the workspace archive, which names the changeset",
	[adapterMoved, moveChangeset],
	function* ({ recordedSources, typecheck }) {
		yield* outcomes([
			["typecheck", () => typecheck(), undefined],
			[
				"recorded sources",
				() => recordedSources(),
				["Installing @fixture/starter-pin@1.0.0 from the workspace archive because .changeset/move-adapter.md releases it (minor)."],
			],
		]);
	},
);

pinnedStarter.it(
	"a pinned dependent of a package that a pending changeset releases follows it into the workspace archive",
	[adapterMoved, moveChangeset, dependentPinned],
	function* ({ recordedSources, typecheck }) {
		yield* outcomes([
			["typecheck", () => typecheck(), undefined],
			[
				"recorded sources",
				() => recordedSources(),
				[
					"Installing @fixture/starter-dependent@1.0.0 from the workspace archive because the next release patches it as a dependent of @fixture/starter-pin.",
					"Installing @fixture/starter-pin@1.0.0 from the workspace archive because .changeset/move-adapter.md releases it (minor).",
				],
			],
		]);
	},
);

pinnedStarter.it(
	"a pinned dependent of a package whose declarations differ from npm follows it into the workspace archive",
	[adapterMoved, helperDeclared, dependentPinned],
	function* ({ recordedSources, typecheck }) {
		yield* outcomes([
			["typecheck", () => typecheck(), undefined],
			[
				"recorded sources",
				() => recordedSources(),
				[
					"Installing @fixture/starter-dependent@1.0.0 from the workspace archive because the next release patches it as a dependent of @fixture/starter-pin.",
					"Installing @fixture/starter-pin@1.0.0 from the workspace archive because dependencies.@fixture/starter-helper is 1.0.0 here and absent on npm.",
				],
			],
		]);
	},
);

pinnedStarter.it(
	"a commit that releases create-app ignores pending changesets, so its pins must already resolve from npm",
	[adapterMoved, moveChangeset, generatorReleased],
	function* ({ recordedSources, typecheck }) {
		yield* outcomes([
			["typecheck", () => typecheck(), expect.stringContaining("Cannot find module '@fixture/starter-pin/adapters/database'")],
			[
				"recorded sources",
				() => recordedSources(),
				[
					"This commit releases @shivaedev/create-app@1.1.0, which is not on npm, so pending changesets wait for the next release and select no archives.",
					"Installing @fixture/starter-pin@1.0.0 from npm because its version and declarations match npm.",
				],
			],
		]);
	},
);
