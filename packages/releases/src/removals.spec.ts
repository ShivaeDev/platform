import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { applied, changeset, dependencyAdded, dependencyRemoved, onMain, rangeSet, removalDeclared, removed } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const UNDECLARED_DEV =
	"refused: @test/dev: declare its rename or removal in .changeset/<name>.md with a ### Breaking entry naming @test/dev. For a rename, name the new package and its bump in frontmatter; for a removal, name a remaining package and its bump. Keep released changelog history unchanged.";
const retireOptional = removalDeclared("@test/optional", "@test/api");
const retireCore = changeset("retire", { "@test/api": "minor" }, `### Breaking\n\n- Remove \`${CORE}\`; use \`@test/api\` directly.\n`);

workspace.it("check refuses @test/dev's undeclared removal and explains how to declare it", [removed("@test/dev")], function* ({ check }) {
	expect(yield* check()).toBe(UNDECLARED_DEV);
});

workspace.it(
	`check accepts @test/optional's removal, declared on main by a Breaking note for ${CORE}`,
	[retireOptional, onMain, dependencyRemoved("@test/peer", "@test/optional"), removed("@test/optional")],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

workspace.it(
	"check accepts the release that consumed @test/optional's removal declaration",
	[retireOptional, onMain, dependencyRemoved("@test/peer", "@test/optional"), removed("@test/optional"), applied],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

for (const { dependency, dependent, declaration } of [
	{ declaration: retireCore, dependency: CORE, dependent: "@test/api" },
	{ declaration: removalDeclared("@test/api", CORE), dependency: "@test/api", dependent: "@test/optional" },
	{ declaration: retireOptional, dependency: "@test/optional", dependent: "@test/peer" },
]) {
	workspace.it(
		`check refuses removing ${dependency} while ${dependent} still has a published dependency on it`,
		[declaration, removed(dependency)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${dependent} depends on removed package ${dependency}; remove or replace this published dependency before planning a release.`,
			);
		},
	);
}

workspace.it(
	"plan refuses a removed workspace dependency and names both packages",
	[retireOptional, removed("@test/optional")],
	function* ({ plan }) {
		expect(yield* plan()).toBe(
			"refused: @test/peer depends on removed package @test/optional; remove or replace this published dependency before planning a release.",
		);
	},
);

workspace.it(
	"plan rejects a missing workspace dependency even when a peer range names the same package",
	[retireCore, dependencyAdded("@test/api", CORE, "^0.2.3", "peerDependencies"), removed(CORE)],
	function* ({ plan }) {
		expect(yield* plan()).toBe(
			`refused: @test/api depends on removed package ${CORE}; remove or replace this published dependency before planning a release.`,
		);
	},
);

workspace.it(
	"check refuses a removed peer even when its range is a registry version",
	[retireOptional, rangeSet("@test/peer", "@test/optional", "^1.0.0"), removed("@test/optional")],
	function* ({ check }) {
		expect(yield* check()).toBe(
			"refused: @test/peer depends on removed package @test/optional; remove or replace this published dependency before planning a release.",
		);
	},
);

workspace.it(
	"plan still releases when the removed package has no dependents",
	[removalDeclared("@test/dev", CORE), removed("@test/dev")],
	function* ({ plan }) {
		expect(yield* plan()).toEqual([
			"@test/api: 0.5.0 -> 0.5.1 (patch)",
			`${CORE}: 0.2.3 -> 0.3.0 (minor)`,
			"@test/optional: 1.0.0 -> 1.0.1 (patch)",
			"@test/peer: 1.0.0 -> 1.0.1 (patch)",
		]);
	},
);

workspace.it(
	"plan ignores development-only and private dependencies on the removed package",
	[retireCore, dependencyRemoved("@test/api", CORE), removed(CORE)],
	function* ({ plan }) {
		expect(yield* plan()).toEqual([
			"@test/api: 0.5.0 -> 0.6.0 (minor)",
			"@test/optional: 1.0.0 -> 1.0.1 (patch)",
			"@test/peer: 1.0.0 -> 1.0.1 (patch)",
		]);
	},
);

workspace.it(
	"check ignores development-only and private dependencies on the removed package",
	[retireCore, dependencyRemoved("@test/api", CORE), removed(CORE)],
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
