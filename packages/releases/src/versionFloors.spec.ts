import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE } from "#test/fixture.ts";
import { changeset, onMain, pending, released, versionSet } from "#test/traits.ts";
import { versionFloors } from "#test/versionFloors.ts";
import { workspace } from "#test/workspace.ts";

for (const [floor, bump, next] of [
	["0.47.9", "minor", "0.48.0"],
	["0.10.9", "patch", "0.10.10"],
	["0.1.9", "minor", "0.3.0"],
	["0.2.3", "minor", "0.3.0"],
	["1.0.0", "minor", "1.1.0"],
] as const) {
	workspace.it(
		`plan bumps ${CORE} from the higher of manifest 0.2.3 and floor ${floor} to ${next} for ${bump}`,
		[versionFloors({ [CORE]: floor }), changeset("fix", { [CORE]: bump }, "### Fixed\n\n- A fix.\n")],
		function* ({ planJson }) {
			expect(yield* planJson()).toEqual(
				expect.objectContaining({ releases: expect.arrayContaining([{ bump, directory: "packages/core", from: "0.2.3", name: CORE, to: next }]) }),
			);
		},
	);
}

workspace.it("plan bumps an automatic dependent above its floor", [pending(), versionFloors({ "@test/api": "0.35.9" })], function* ({ planJson }) {
	expect(yield* planJson()).toEqual(
		expect.objectContaining({
			releases: expect.arrayContaining([{ bump: "patch", directory: "packages/api", from: "0.5.0", name: "@test/api", to: "0.35.10" }]),
		}),
	);
});

workspace.it("a floor alone does not request a release", [versionFloors({ [CORE]: "0.47.9" })], function* ({ plan }) {
	expect(yield* plan()).toEqual(["No pending releases."]);
});

workspace.it(
	"apply writes the version above the floor and check accepts the collected release",
	[pending(), versionFloors({ [CORE]: "0.47.9", "@test/api": "0.35.9" }), onMain],
	function* ({ apply, check, version, changelog }) {
		yield* apply();

		yield* outcomes([
			["core version", () => version(CORE), "0.48.0"],
			["dependent version", () => version("@test/api"), "0.35.10"],
			["release heading", () => changelog(CORE), expect.stringContaining("## 0.48.0 - 2026-06-15")],
			["release check", () => check(), "valid"],
		]);
	},
);

workspace.it(
	"check still refuses a hand-edited version above the floor",
	[pending(), versionFloors({ [CORE]: "0.47.9" }), released, versionSet(CORE, "0.49.0")],
	function* ({ check }) {
		expect(yield* check()).toBe(
			`refused: ${CORE}: version differs from the release plan; restore versions and rerun releases apply, including published dependents.`,
		);
	},
);

workspace.it(
	"plan refuses a prerelease version floor with the package and invalid value",
	[pending(), versionFloors({ [CORE]: "0.47.9-beta.1" })],
	function* ({ plan }) {
		expect(yield* plan()).toBe(
			`refused: ${CORE} version floor: use a stable major.minor.patch version before planning a release; found 0.47.9-beta.1.`,
		);
	},
);
