import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { pnpmWorkspacePatterns } from "#imports/pnpmWorkspacePatterns.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const BLOCK = [
	"# workspace",
	"packages:",
	"  - apps/*",
	"# libraries",
	"  - 'libs/*' # shared",
	'  - "tools/#build"',
	"",
	"  -   !**/fixtures/**",
	"catalog:",
	"  effect: 4.0.0",
].join("\n");

describe("pnpm workspace patterns", () => {
	it.effect("reads a block list through comments at any column, quotes and trailing comments, and stops at the next key", function* () {
		yield* assertThat(pnpmWorkspacePatterns(BLOCK), (actual) => actual.toEqual(["apps/*", "libs/*", "tools/#build", "!**/fixtures/**"]));
	});

	it.effect.each([
		["list items at column 0", "packages:\n- apps/*\n- libs/*\n", ["apps/*", "libs/*"]],
		["a flow list over several lines", "packages: [\n  apps/*, # apps\n  'libs/*',\n]\n", ["apps/*", "libs/*"]],
		["a quoted packages key", '"packages":\n  - apps/*\n', ["apps/*"]],
		["quoted patterns with braces in a flow list", "'packages': [\"apps/{web,admin}\", 'libs/*']\n", ["apps/{web,admin}", "libs/*"]],
		["no packages key", "catalog:\n  effect: 4.0.0\n", []],
	] satisfies ReadonlyArray<readonly [unknown, unknown, unknown]>)("reads %s", function* ([_, text, patterns]) {
		yield* assertThat(pnpmWorkspacePatterns(text), (actual) => actual.toEqual(patterns));
	});

	it.effect.each([
		["an unknown escape", 'packages:\n  - "apps/\\q"\n', 'cannot read ""apps/\\q"" in packages'],
		["an empty item", "packages:\n  -\n", 'cannot read "" in packages'],
		["a mapping item", "packages:\n  - {apps: true}\n", 'cannot read "{apps: true}" in packages'],
		["text after the flow list", "packages: [apps/*] unexpected\n", 'cannot read "unexpected" after the packages list'],
		["a key among the items", "packages:\n  - apps/*\n  libs: true\n", 'cannot read "libs: true" in packages'],
		["a scalar packages value", "packages: apps/*\n", 'cannot read "apps/*" in packages'],
		["an unclosed flow list", "packages: [apps/*\n", "the packages list never closes"],
		[
			"an unquoted brace pattern in a flow list",
			"packages: [apps/{web,admin}]\n",
			'cannot read "apps/{web" in packages; quote a pattern that holds { } [ ] or ,',
		],
	] satisfies ReadonlyArray<readonly [unknown, unknown, unknown]>)(
		"refuses %s instead of dropping packages, naming the problem",
		function* ([_, text, reason]) {
			yield* assertThat(
				() => pnpmWorkspacePatterns(text),
				(actual) => actual.toThrow(`pnpm-workspace.yaml: ${reason}`),
			);
		},
	);
});
