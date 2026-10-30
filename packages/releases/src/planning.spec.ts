import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { changeset, dependencyAdded, pending, versionSet } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const coreRelease = [
	"@test/api: 0.5.0 -> 0.5.1 (patch)",
	`${CORE}: 0.2.3 -> 0.3.0 (minor)`,
	"@test/optional: 1.0.0 -> 1.0.1 (patch)",
	"@test/peer: 1.0.0 -> 1.0.1 (patch)",
];

workspace.it(
	"plan --json lists breaking.md and feature.md with their text in filename order, and each release's directory, versions and bump",
	[
		changeset("feature", { [CORE]: "patch", "@test/api": "minor" }, "### Fixed\n\n- A fix.\n"),
		changeset("breaking", { [CORE]: "minor" }, "### Breaking\n\n- A deliberate breaking change.\n"),
	],
	function* ({ changesetText, planJson }) {
		const breaking = yield* changesetText("breaking.md");
		const feature = yield* changesetText("feature.md");

		expect(yield* planJson()).toEqual({
			changesets: [
				{ name: "breaking.md", text: breaking },
				{ name: "feature.md", text: feature },
			],
			releases: [
				{ bump: "minor", directory: "packages/api", from: "0.5.0", name: "@test/api", to: "0.6.0" },
				{ bump: "minor", directory: "packages/core", from: "0.2.3", name: CORE, to: "0.3.0" },
				{ bump: "patch", directory: "packages/optional", from: "1.0.0", name: "@test/optional", to: "1.0.1" },
				{ bump: "patch", directory: "packages/peer", from: "1.0.0", name: "@test/peer", to: "1.0.1" },
			],
		});
	},
);

for (const [first, second] of [
	["minor", "patch"],
	["patch", "minor"],
] as const) {
	workspace.it(
		`plan releases ${CORE} as minor when a-${first}.md asks for ${first} and b-${second}.md for ${second}`,
		[
			changeset(`a-${first}`, { [CORE]: first }, "### Fixed\n\n- A fix.\n"),
			changeset(`b-${second}`, { [CORE]: second }, "### Fixed\n\n- Another fix.\n"),
		],
		function* ({ plan }) {
			expect(yield* plan()).toEqual(coreRelease);
		},
	);
}

workspace.it(
	`plan patches ${CORE}'s published dependents transitively through dependencies, optional and peer dependencies, but not its private or development-only dependents`,
	[pending()],
	function* ({ plan }) {
		expect(yield* plan()).toEqual(coreRelease);
	},
);

workspace.it(
	`plan patches @test/dev, which reaches ${CORE} through @test/optional and @test/api, though its folder sorts before @test/optional's`,
	[pending(), dependencyAdded("@test/dev", "@test/optional", "^1.0.0")],
	function* ({ plan }) {
		expect(yield* plan()).toEqual([
			"@test/api: 0.5.0 -> 0.5.1 (patch)",
			`${CORE}: 0.2.3 -> 0.3.0 (minor)`,
			"@test/dev: 1.0.0 -> 1.0.1 (patch)",
			"@test/optional: 1.0.0 -> 1.0.1 (patch)",
			"@test/peer: 1.0.0 -> 1.0.1 (patch)",
		]);
	},
);

workspace.it("plan writes nothing", [pending()], function* ({ plan, workspaceFiles }) {
	const files = yield* workspaceFiles();

	yield* plan();

	expect(yield* workspaceFiles()).toEqual(files);
});

workspace.it(
	"plan releases @test/optional 1.2.3 as 2.0.0 when asked for major, and patches its dependent @test/peer",
	[pending({ "@test/optional": "major" }), versionSet("@test/optional", "1.2.3")],
	function* ({ plan }) {
		expect(yield* plan()).toEqual(["@test/optional: 1.2.3 -> 2.0.0 (major)", "@test/peer: 1.0.0 -> 1.0.1 (patch)"]);
	},
);
