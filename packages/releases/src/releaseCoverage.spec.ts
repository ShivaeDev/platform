import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baseFromReleaseBranch, mainAdvanced, recordedReleaseBase, squashedRelease } from "#test/mainAdvanced.ts";
import { applied, changelogEdited, changeset, changesetDeleted, changesetEdited, laterChangeset, onMain, pending } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

workspace.it(
	"a queued release behind main refuses publishing and names every uncovered changeset's commit and the repair",
	[pending(), onMain, applied, mainAdvanced],
	function* ({ check }) {
		const answer = yield* check("main");

		expect(answer).toContain("refused: Release leaves pending changesets outside its notes: breaking.md, independent.md.");
		expect(answer).toMatch(/[a-f\d]+ Replace the core API; migrate to the new API\./u);
		expect(answer).toMatch(/[a-f\d]+ Correct independent dev behavior\./u);
		expect(answer).toContain("Let the release PR regenerate before merging or publishing.");
	},
);

workspace.it(
	"a release covering every pending changeset passes the publishing check after main advances",
	[pending(), onMain, mainAdvanced],
	function* ({ apply, check }) {
		yield* apply();

		expect(yield* check("main")).toBe("valid");
	},
);

for (const [state, traits, base] of [
	["merge group", [], "main"],
	["squash merge", [squashedRelease], "HEAD^"],
] as const) {
	workspace.it(
		`a frozen release in a ${state} leaves changesets added later on main pending`,
		[pending(), onMain, recordedReleaseBase, applied, mainAdvanced, ...traits],
		function* ({ check, changesetText, version }) {
			yield* outcomes([
				["release validation", () => check(base), "valid"],
				["deferred core input", () => changesetText("breaking.md"), expect.stringContaining("Replace the core API")],
				["deferred dev input", () => changesetText("independent.md"), expect.stringContaining("Correct independent dev behavior.")],
				["unreleased dev version", () => version("@test/dev"), "1.0.0"],
			]);
		},
	);
}

const FIX = "### Fixed\n\n- A second fix.\n";
const originalFix = changeset("second", { "@test/core": "patch" }, FIX);

for (const [description, change] of [
	["drops second.md", changesetDeleted("second")],
	["rewrites feature.md", changesetEdited("feature", { "@test/core": "minor" }, "### Added\n\n- Rewritten feature.\n")],
] as const) {
	workspace.it(
		`a frozen release that ${description} from its base fails validation`,
		[pending(), originalFix, onMain, recordedReleaseBase, change, applied],
		function* ({ check }) {
			expect(yield* check()).toContain("release notes differ from releases apply");
		},
	);
}

workspace.it(
	"a frozen release cannot leave an original base input pending outside its notes",
	[
		pending(),
		originalFix,
		onMain,
		recordedReleaseBase,
		applied,
		laterChangeset("second", { "@test/core": "patch" }, FIX),
		changelogEdited("@test/core", "### Fixed\n\n- A second fix.\n\n", ""),
	],
	function* ({ check }) {
		expect(yield* check()).toContain("Release leaves pending changesets outside its notes: second.md.");
	},
);

workspace.it(
	"a recorded base does not allow pending changesets added only on the release branch",
	[pending(), onMain, recordedReleaseBase, applied, laterChangeset("branch-only", { "@test/core": "patch" }, FIX)],
	function* ({ check }) {
		expect(yield* check()).toContain("Release leaves pending changesets outside its notes: branch-only.md.");
	},
);

workspace.it(
	"the recorded base cannot point outside the checked main history",
	[pending(), onMain, recordedReleaseBase, applied, mainAdvanced, baseFromReleaseBranch],
	function* ({ check }) {
		expect(yield* check("main")).toBe("refused: The recorded release base must be an ancestor of the checked main revision.");
	},
);

workspace.it(
	"a frozen release cannot rewrite a changeset deferred from main",
	[
		pending(),
		onMain,
		recordedReleaseBase,
		applied,
		mainAdvanced,
		changesetEdited("breaking", { "@test/core": "minor" }, "### Breaking\n\n- Altered API; migrate to the replacement.\n"),
	],
	function* ({ check }) {
		expect(yield* check("main")).toBe(
			"refused: breaking.md: keep pending changesets unchanged; add a new file for later changes or run releases apply to consume them.",
		);
	},
);
