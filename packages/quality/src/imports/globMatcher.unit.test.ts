import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { globMatcher } from "#imports/globMatcher.ts";

describe("globMatcher", () => {
	it.effect("matches *, **, ?, braces and character classes the way pnpm does, never a dot segment unless the pattern names the dot", function* () {
		const cases: ReadonlyArray<readonly [string, string, boolean]> = [
			["packages/*", "packages/web", true],
			["packages/*", "packages/web/test", false],
			["apps/**", "apps/web/test", true],
			["packages/{heavy-lock,platform}", "packages/platform", true],
			["packages/{heavy-lock,platform}", "packages/work-board", false],
			["packages/{a,{b,c}}-x", "packages/c-x", true],
			["packages/we?", "packages/web", true],
			["packages/we?", "packages/we", false],
			["packages/[a-c]pp", "packages/bpp", true],
			["packages/[!a-c]pp", "packages/bpp", false],
			["packages/[!a-c]pp", "packages/zpp", true],
			["packages/**", "packages/effect-trpc/.server-kit", false],
			["packages/*", "packages/.hidden", false],
			["packages/?hidden", "packages/.hidden", false],
			["packages/[.]hidden", "packages/.hidden", false],
			["packages/.hidden", "packages/.hidden", true],
			["packages/.*", "packages/.hidden", true],
		];
		yield* assertThat(
			cases.map(([pattern, path]) => globMatcher(pattern)(path)),
			(actual) => actual.toEqual(cases.map(([, , expected]) => expected)),
		);
	});

	it.effect.each([
		["packages/{web}", "a { } needs two or more choices"],
		["packages/[[:alpha:]]", "character class names are not supported"],
		["packages/\\*", "escapes are not supported"],
	] satisfies ReadonlyArray<readonly [unknown, unknown]>)("explains why the workspace pattern %s is unsupported", function* ([pattern, reason]) {
		yield* assertThat(
			() => globMatcher(pattern),
			(actual) => actual.toThrow(`cannot read the workspace pattern "${pattern}": ${reason}`),
		);
	});

	it.effect("refuses a pattern it cannot read instead of matching nothing", function* () {
		yield* assertThat(
			() => globMatcher("packages/{a,b"),
			(actual) => actual.toThrow('cannot read the workspace pattern "packages/{a,b": a { never closes'),
		);
		yield* assertThat(
			() => globMatcher("packages/[ab"),
			(actual) => actual.toThrow('cannot read the workspace pattern "packages/[ab": a [ never closes'),
		);
		yield* assertThat(
			() => globMatcher("packages/+(a|b)"),
			(actual) => actual.toThrow('cannot read the workspace pattern "packages/+(a|b)": extended globs are not supported'),
		);
		yield* assertThat(
			() => globMatcher("packages/{1..3}"),
			(actual) => actual.toThrow('cannot read the workspace pattern "packages/{1..3}": brace ranges are not supported'),
		);
	});
});
