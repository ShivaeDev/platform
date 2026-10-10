import { describe, expect, it } from "vitest";
import { globMatcher } from "#imports/glob.ts";

describe("globMatcher", () => {
	it("matches *, **, ?, braces and character classes the way pnpm does, never a dot segment unless the pattern names the dot", () => {
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
		expect(cases.map(([pattern, path]) => globMatcher(pattern)(path))).toEqual(cases.map(([, , expected]) => expected));
	});

	it.each([
		["packages/{web}", "a { } needs two or more choices"],
		["packages/[[:alpha:]]", "character class names are not supported"],
		["packages/\\*", "escapes are not supported"],
	])("explains why the workspace pattern %s is unsupported", (pattern, reason) => {
		expect(() => globMatcher(pattern)).toThrow(`cannot read the workspace pattern "${pattern}": ${reason}`);
	});

	it("refuses a pattern it cannot read instead of matching nothing", () => {
		expect(() => globMatcher("packages/{a,b")).toThrow('cannot read the workspace pattern "packages/{a,b": a { never closes');
		expect(() => globMatcher("packages/[ab")).toThrow('cannot read the workspace pattern "packages/[ab": a [ never closes');
		expect(() => globMatcher("packages/+(a|b)")).toThrow('cannot read the workspace pattern "packages/+(a|b)": extended globs are not supported');
		expect(() => globMatcher("packages/{1..3}")).toThrow('cannot read the workspace pattern "packages/{1..3}": brace ranges are not supported');
	});
});
