import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { applied, historyRewritten, moved, onMain, renameDeclared, renamed } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const RENAMED = "@test/renamed";

const UNDECLARED_DEV =
	"refused: @test/dev: declare its rename or removal in .changeset/<name>.md with a ### Breaking entry naming @test/dev. For a rename, name the new package and its bump in frontmatter; for a removal, name a remaining package and its bump. Keep released changelog history unchanged.";

for (const { declaration, place, renaming } of [
	{ declaration: renameDeclared(CORE, RENAMED, { entry: "naming both" }), place: "in place", renaming: [renamed(CORE, RENAMED)] },
	{
		declaration: renameDeclared(CORE, RENAMED),
		place: "into packages/renamed",
		renaming: [renamed(CORE, RENAMED), moved(RENAMED, "packages/renamed")],
	},
]) {
	const declaredOnMain = [declaration, onMain, ...renaming];

	workspace.it(`check accepts ${CORE}'s rename to ${RENAMED} ${place}, declared on main`, declaredOnMain, function* ({ check }) {
		expect(yield* check()).toBe("valid");
	});

	workspace.it(`check accepts the applied release of ${RENAMED}, renamed ${place}`, [...declaredOnMain, applied], function* ({ check }) {
		expect(yield* check()).toBe("valid");
	});

	workspace.it(
		`check refuses rewritten released history in ${RENAMED}'s changelog after its release, renamed ${place}`,
		[...declaredOnMain, applied, historyRewritten(RENAMED)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${RENAMED}: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.`,
			);
		},
	);
}

workspace.it(
	`check refuses rewritten released history in the moved ${RENAMED}'s changelog before its release`,
	[renameDeclared(CORE, RENAMED), onMain, renamed(CORE, RENAMED), moved(RENAMED, "packages/renamed"), historyRewritten(RENAMED)],
	function* ({ check }) {
		expect(yield* check()).toBe(`refused: ${RENAMED}: CHANGELOG.md changes require a version bump; add .changeset/<name>.md and run releases apply.`);
	},
);

workspace.it(
	`check accepts @test/dev's move to packages/renamed as ${RENAMED}, declared by a pending changeset`,
	[renamed("@test/dev", RENAMED), moved(RENAMED, "packages/renamed"), renameDeclared("@test/dev", RENAMED)],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

workspace.it(
	`check refuses @test/dev's undeclared move to packages/renamed as ${RENAMED} and explains how to declare it`,
	[renamed("@test/dev", RENAMED), moved(RENAMED, "packages/renamed")],
	function* ({ check }) {
		expect(yield* check()).toBe(UNDECLARED_DEV);
	},
);

workspace.it(
	`check refuses a rename of @test/dev to ${RENAMED} whose declaration names ${CORE} instead of ${RENAMED} in frontmatter`,
	[renameDeclared("@test/dev", RENAMED, { frontmatter: CORE }), renamed("@test/dev", RENAMED)],
	function* ({ check }) {
		expect(yield* check()).toBe(UNDECLARED_DEV);
	},
);
