import { expect } from "@effect/vitest";
import { CORE, changeset } from "#test/fixture.ts";
import { changesetReading, pending, versionSet } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const { description, file, refusal, text } of [
	{
		description: "without frontmatter",
		file: "missing-frontmatter",
		refusal: "add YAML frontmatter between --- lines, mapping package names to patch, minor or major.",
		text: "### Added\n\n- Missing bumps.\n",
	},
	{
		description: "with a YAML list as frontmatter",
		file: "invalid-mapping",
		refusal: `use one YAML package: bump mapping per line, for example '"@scope/pkg": minor'.`,
		text: "---\n- core\n---\n### Added\n\n- Feature.\n",
	},
	{
		description: "with empty frontmatter",
		file: "empty-frontmatter",
		refusal: "name at least one package and its explicit bump in frontmatter.",
		text: "---\n\n---\n### Added\n\n- Feature.\n",
	},
	{
		description: "naming the unknown package @test/missing",
		file: "unknown-package",
		refusal: "unknown package @test/missing; fix the name or include its directory in config.packages.",
		text: changeset({ "@test/missing": "patch" }),
	},
	{
		description: `asking for an auto bump of ${CORE}`,
		file: "invalid-bump",
		refusal: `${CORE} needs an explicit patch, minor or major bump.`,
		text: changeset({ [CORE]: "auto" }),
	},
	{
		description: "naming the private @test/private",
		file: "private-package",
		refusal: "@test/private is private; remove it from release frontmatter.",
		text: changeset({ "@test/private": "patch" }),
	},
	{
		description: `naming ${CORE} twice`,
		file: "duplicate-package",
		refusal: "name each package once in frontmatter.",
		text: `---\n"${CORE}": patch\n"${CORE}": minor\n---\n### Added\n\n- Feature.\n`,
	},
	{
		description: "under a ### Features heading",
		file: "invalid-section",
		refusal: "use ### Added, ### Changed, ### Fixed or ### Breaking.",
		text: changeset({ [CORE]: "patch" }, "### Features\n\n- Feature.\n"),
	},
	{
		description: "with an entry outside a section",
		file: "missing-section",
		refusal: "start each entry with '- ' under a ### section heading.",
		text: changeset({ [CORE]: "patch" }, "- Feature.\n"),
	},
	{
		description: "with an empty entry",
		file: "empty-entry",
		refusal: "write text after '- '.",
		text: changeset({ [CORE]: "patch" }, "### Fixed\n\n- \n"),
	},
	{
		description: "with a section but no entry",
		file: "empty-body",
		refusal: "add at least one release-note entry under a ### section heading.",
		text: changeset({ [CORE]: "patch" }, "### Added\n"),
	},
]) {
	workspace.it(
		`check refuses ${file}.md, a changeset ${description}, and names the file and its repair`,
		[changesetReading(file, `a changeset ${description}`, text)],
		function* ({ check }) {
			expect(yield* check()).toBe(`refused: ${file}.md: ${refusal}`);
		},
	);
}

for (const command of ["check", "plan", "apply"] as const) {
	workspace.it(`${command} refuses feature.md's major bump of the 0.x ${CORE} and asks for minor`, [pending({ [CORE]: "major" })], function* (verbs) {
		expect(yield* verbs[command]()).toBe(
			`refused: feature.md: ${CORE} has a major bump but is a 0.x package; use minor for breaking changes before 1.0.`,
		);
	});
}

workspace.it(
	`check refuses a pending bump of ${CORE}'s prerelease 0.3.0-beta.1 and asks for a stable major.minor.patch version`,
	[pending(), versionSet(CORE, "0.3.0-beta.1")],
	function* ({ check }) {
		expect(yield* check()).toBe(`refused: ${CORE}: use a stable major.minor.patch version before planning a release; found 0.3.0-beta.1.`);
	},
);
