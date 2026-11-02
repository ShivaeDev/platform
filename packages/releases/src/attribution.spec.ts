import { expect } from "@effect/vitest";
import { CORE, RELEASED_HISTORY } from "#test/fixture.ts";
import { applied, changeset, changesetEdited, onMain } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const packages = { [CORE]: "minor", "@test/api": "patch" };
const ATTRIBUTED = "### Added\n\n- `@test/core`: Add core behavior.\n\n### Fixed\n\n- `@test/api`: Fix API behavior.\n  Keep its continuation.\n";
const shared = changeset("shared", packages, ATTRIBUTED);

workspace.it(
	"apply gives each package only its attributed bullets, preserving continuations and history, with the same sections as release notes",
	[shared],
	function* ({ apply, changelog, releaseNotes, todayInUtc }) {
		const notes = yield* releaseNotes();

		yield* apply();

		for (const { name, version, sections } of [
			{ name: CORE, sections: "### Added\n\n- Add core behavior.\n", version: "0.3.0" },
			{ name: "@test/api", sections: "### Fixed\n\n- Fix API behavior.\n  Keep its continuation.\n", version: "0.5.1" },
		]) {
			expect(yield* changelog(name)).toBe(`# Changelog\n\n## ${version} - ${yield* todayInUtc()}\n\n${sections}\n${RELEASED_HISTORY}`);
			expect(notes).toContain(`## ${name} ${version}\n\n${sections}\n\n`);
		}
	},
);

for (const { description, bullet } of [
	{ bullet: "- No package owns this fix.", description: "an unattributed bullet" },
	{ bullet: "- `@test/typo`: Fix behavior.", description: "a bullet attributed to a package absent from frontmatter" },
]) {
	workspace.it(
		`check refuses shared.md with ${description} and names the file and required syntax`,
		[changeset("shared", packages, `### Fixed\n\n${bullet}\n`)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: shared.md: attribute each bullet to one package named in frontmatter with '- \`package-name\`: text'; found ${bullet}.`,
			);
		},
	);
}

workspace.it("check accepts a release collected from attributed changesets on main", [shared, onMain, applied], function* ({ check }) {
	expect(yield* check()).toBe("valid");
});

workspace.it(
	"check accepts adding attribution to an unchanged legacy pending changeset",
	[
		changeset("shared", packages, "### Added\n\n- Add core behavior.\n\n### Fixed\n\n- Fix API behavior.\n  Keep its continuation.\n"),
		onMain,
		changesetEdited("shared", packages, ATTRIBUTED),
	],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

for (const { description, body } of [
	{ body: ATTRIBUTED.replace("Add core behavior.", "Rewrite core behavior."), description: "rewriting a bullet" },
	{ body: ATTRIBUTED.replace("`@test/api`:", "`@test/core`:"), description: "moving an attributed bullet to another package" },
]) {
	workspace.it(
		`check refuses ${description} in main's shared.md`,
		[shared, onMain, changesetEdited("shared", packages, body)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				"refused: shared.md: keep pending changesets unchanged; add a new file for later changes or run releases apply to consume them.",
			);
		},
	);
}
