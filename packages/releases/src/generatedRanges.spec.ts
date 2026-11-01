import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { pending, rangeSet, released } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const [dependent, dependency, field, range, expected] of [
	["@test/api", CORE, "dependencies", "0.2.3", "0.3.0"],
	["@test/optional", "@test/api", "optionalDependencies", "^0.5.0", "^0.5.1"],
	["@test/peer", "@test/optional", "peerDependencies", "workspace:~2.0.0", "workspace:~1.0.1"],
] as const) {
	workspace.it(
		`check refuses ${dependent}'s generated ${field} range ${range} for ${dependency}`,
		[pending(), released, rangeSet(dependent, dependency, range)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${dependent}: ${field} range for ${dependency} is ${range}, but the release plan requires ${expected}; rerun releases apply.`,
			);
		},
	);
}

for (const range of [
	"0.2.3",
	"^0.2.3",
	"~0.2.3",
	"workspace:0.2.3",
	"workspace:^0.2.3",
	"workspace:~0.2.3",
	"workspace:*",
	"workspace:^",
	"workspace:~",
]) {
	workspace.it(`check accepts a release applied with ${range}`, [pending(), rangeSet("@test/api", CORE, range), released], function* ({ check }) {
		expect(yield* check()).toBe("valid");
	});
}
