import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { changeset } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const larger = changeset("larger", { [CORE]: "minor" });
const REFUSAL = `refused: too-small.md: ${CORE} has a patch bump but its sections require at least minor; use minor for Added or Breaking before 1.0.`;

for (const section of ["Breaking", "Added"]) {
	workspace.it(
		`check refuses a patch with ${section} notes in too-small.md, though larger.md asks for minor`,
		[larger, changeset("too-small", { [CORE]: "patch" }, `### ${section}\n\n- New behavior.\n`)],
		function* ({ check }) {
			expect(yield* check()).toBe(REFUSAL);
		},
	);
}

for (const command of ["plan", "apply"] as const) {
	workspace.it(
		`${command} refuses a patch with Added notes in too-small.md, though larger.md asks for minor`,
		[larger, changeset("too-small", { [CORE]: "patch" }, "### Added\n\n- New behavior.\n")],
		function* (verbs) {
			expect(yield* verbs[command]()).toBe(REFUSAL);
		},
	);
}

for (const { body, bump } of [
	{ body: "### Breaking\n\n- Migrate to the new behavior.\n", bump: "minor" },
	{ body: "### Fixed\n\n- Correct existing behavior.\n", bump: "patch" },
	{ body: "### Changed\n\n- Adjust existing behavior.\n\n### Fixed\n\n- Correct existing behavior.\n", bump: "patch" },
]) {
	const sections = [...body.matchAll(/^### (?<section>.+)$/gmu)].map((match) => match.groups?.section).join(" and ");
	workspace.it(`check accepts a ${bump} with ${sections} notes`, [changeset("valid", { [CORE]: bump }, body)], function* ({ check }) {
		expect(yield* check()).toBe("valid");
	});
}

workspace.it(
	`check refuses shared.md's patch for @test/api with Added notes, though it asks minor for ${CORE}`,
	[changeset("shared", { [CORE]: "minor", "@test/api": "patch" })],
	function* ({ check }) {
		expect(yield* check()).toBe(
			"refused: shared.md: @test/api has a patch bump but its sections require at least minor; use minor for Added or Breaking before 1.0.",
		);
	},
);
