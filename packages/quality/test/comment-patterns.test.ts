import { describe, expect, it } from "vitest";
import type { Rule } from "../src/index.ts";
import { noBanner } from "../src/rules/comments/no-banner.ts";
import { noLineReference } from "../src/rules/comments/no-line-reference.ts";
import { noPrReference } from "../src/rules/comments/no-pr-reference.ts";
import { noTodo } from "../src/rules/comments/no-todo.ts";
import { checkRule, issuesOf } from "./support/inputs.ts";

const messagesFor = async (rule: Rule<string, undefined>, comment: string) =>
	(await checkRule(rule, undefined, { sources: [{ content: `export const a = 1;\n${comment}\n`, path: "src/a.ts" }] })).map(
		(finding) => `${finding.line} ${finding.message}`,
	);

interface Case {
	readonly fires: ReadonlyArray<readonly [string, string]>;
	readonly quiet: ReadonlyArray<string>;
	readonly rule: Rule<string, undefined>;
}

const cases: ReadonlyArray<Case> = [
	{
		fires: [
			["// see src/a.ts:42", "src/a.ts:42"],
			["// thrown from view.tsx:12:5", "view.tsx:12"],
			["// matches config.json#L10", "config.json#L10"],
			["// line 42 sets it", "line 42"],
			["/* Lines 10-20 parse the header */", "Lines 10"],
		],
		quiet: ["// one line of output", "// keeps 150 lines", "// listens on example.com:8080", "// within max-lines 150", "// runs at 10:30"],
		rule: noLineReference,
	},
	{
		fires: [
			["// fixed in #1234", "#1234"],
			["// see PR 56", "PR 56"],
			["// since PR #7", "PR #7"],
			["// works around issue 12", "issue 12"],
			["// https://github.com/acme/app/pull/9", "/pull/9"],
			["// https://gitlab.com/acme/app/-/issues/3", "/issues/3"],
			["// GH-44", "GH-44"],
		],
		quiet: ["// the #private field", "// encodes &#169; as an entity", "// https://example.com/docs#3", "// version 1.2.3", "// step 2"],
		rule: noPrReference,
	},
	{
		fires: [
			["// ---", "---"],
			["// ===== Helpers =====", "====="],
			["// ─── Setup ───", "───"],
			["/* ********** */", "**********"],
			["//#region Setup", "#region"],
			["// #endregion", "#endregion"],
			["/**\n * Parsing\n * -------\n */", "-------"],
		],
		quiet: [
			"// a === b",
			"// maps a -> b",
			"// pass --flag",
			"/**\n * A plain doc.\n */",
			"// ends with a path a/b",
			"/*#__PURE__*/",
			"/*#__NO_SIDE_EFFECTS__*/",
		],
		rule: noBanner,
	},
	{
		fires: [
			["// TODO: later", "TODO"],
			["// FIXME", "FIXME"],
			["/* XXX */", "XXX"],
			["/** @todo split this */", "@todo"],
		],
		quiet: ["// a todo list", "// TODOS are tracked elsewhere", "// sizes up to XXXL"],
		rule: noTodo,
	},
];

describe.each(cases)("$rule.id", ({ fires, quiet, rule }) => {
	it.each(fires)("fires on %j", async (comment, match) => {
		const [finding, ...rest] = await messagesFor(rule, comment);
		expect(rest).toEqual([]);
		expect(finding).toMatch(/^2 /u);
		expect(finding).toContain(`"${match}"`);
	});

	it.each(quiet)("stays quiet on %j", async (comment) => {
		expect(await messagesFor(rule, comment)).toEqual([]);
	});

	it("takes no options", async () => {
		expect(await issuesOf(rule, { strict: true })).toEqual(["this rule takes no options"]);
	});
});
