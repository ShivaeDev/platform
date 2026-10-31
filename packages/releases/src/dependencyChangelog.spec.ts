import { expect } from "@effect/vitest";
import { CORE, HISTORY, RELEASED_HISTORY } from "#test/fixture.ts";
import { changelogEdited, dependencyAdded, pending, released } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const { dependency, dependent, from, to, version } of [
	{ dependency: CORE, dependent: "@test/api", from: "0.2.3", to: "0.3.0", version: "0.5.1" },
	{ dependency: "@test/api", dependent: "@test/optional", from: "0.5.0", to: "0.5.1", version: "1.0.1" },
	{ dependency: "@test/optional", dependent: "@test/peer", from: "1.0.0", to: "1.0.1", version: "1.0.1" },
]) {
	workspace.it(
		`apply names ${dependency}'s move from ${from} to ${to} in ${dependent}'s dependency-only changelog`,
		[pending()],
		function* ({ apply, changelog, todayInUtc }) {
			expect(yield* changelog(dependent)).toBe(HISTORY);

			yield* apply();

			expect(yield* changelog(dependent)).toBe(
				`# Changelog\n\n## ${version} - ${yield* todayInUtc()}\n\n### Changed\n\n- Update \`${dependency}\` from ${from} to ${to}.\n\n${RELEASED_HISTORY}`,
			);
		},
	);
}

workspace.it(
	"apply lists each moved direct dependency once in @test/peer's changelog, excluding unchanged and indirect dependencies",
	[
		pending(),
		dependencyAdded("@test/peer", CORE, "workspace:*"),
		dependencyAdded("@test/peer", "@test/optional", "^1.0.0"),
		dependencyAdded("@test/peer", "@test/dev", "workspace:*"),
	],
	function* ({ apply, changelog, todayInUtc }) {
		expect(yield* changelog("@test/peer")).toBe(HISTORY);

		yield* apply();

		expect(yield* changelog("@test/peer")).toBe(
			`# Changelog\n\n## 1.0.1 - ${yield* todayInUtc()}\n\n### Changed\n\n- Update \`${CORE}\` from 0.2.3 to 0.3.0.\n- Update \`@test/optional\` from 1.0.0 to 1.0.1.\n\n${RELEASED_HISTORY}`,
		);
	},
);

for (const [description, note] of [
	["is missing", ""],
	["has the wrong old version", `- Update \`${CORE}\` from 0.2.2 to 0.3.0.\n`],
	["has the wrong new version", `- Update \`${CORE}\` from 0.2.3 to 0.4.0.\n`],
] as const) {
	workspace.it(
		`check refuses @test/api's dependency-only release when its dependency note ${description}`,
		[pending(), released, changelogEdited("@test/api", `- Update \`${CORE}\` from 0.2.3 to 0.3.0.\n`, note)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				"refused: @test/api: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.",
			);
		},
	);
}
