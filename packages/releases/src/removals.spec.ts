import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { applied, changeset, onMain, removalDeclared, removed } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const UNDECLARED_DEV =
	"refused: @test/dev: declare its rename or removal in .changeset/<name>.md with a ### Breaking entry naming @test/dev. For a rename, name the new package and its bump in frontmatter; for a removal, name a remaining package and its bump. Keep released changelog history unchanged.";
const retireOptional = removalDeclared("@test/optional", "@test/api");

workspace.it("check refuses @test/dev's undeclared removal and explains how to declare it", [removed("@test/dev")], function* ({ check }) {
	expect(yield* check()).toBe(UNDECLARED_DEV);
});

workspace.it(
	`check accepts @test/optional's removal, declared on main by a Breaking note for ${CORE}`,
	[retireOptional, onMain, removed("@test/optional")],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

workspace.it(
	"check accepts the release that consumed @test/optional's removal declaration",
	[retireOptional, onMain, removed("@test/optional"), applied],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

for (const [description, body] of [
	["a Changed entry", "### Changed\n\n- Remove `@test/dev`.\n"],
	["a Breaking entry naming @test/dev-tools", "### Breaking\n\n- Remove `@test/dev-tools`.\n"],
] as const) {
	workspace.it(
		`check refuses ${description} as the declaration of @test/dev's removal`,
		[changeset("retire", { [CORE]: "minor" }, body), removed("@test/dev")],
		function* ({ check }) {
			expect(yield* check()).toBe(UNDECLARED_DEV);
		},
	);
}
