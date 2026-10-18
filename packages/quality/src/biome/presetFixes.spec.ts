import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const RuleSetting = Schema.Union([Schema.String, Schema.Struct({ fix: Schema.optionalKey(Schema.String), level: Schema.String })]);

const Preset = Schema.Struct({
	assist: Schema.Struct({
		actions: Schema.Struct({
			source: Schema.Struct({ organizeImports: Schema.Struct({ options: Schema.Struct({ groups: Schema.Array(Schema.Array(Schema.String)) }) }) }),
		}),
	}),
	linter: Schema.Struct({ rules: Schema.Record(Schema.String, Schema.Record(Schema.String, RuleSetting)) }),
});

const preset = Schema.decodeUnknownSync(Schema.fromJsonString(Preset))(readFileSync(new URL("../../biome/preset.json", import.meta.url), "utf8"));

const AUTHOR_REPAIRS = [
	"noAccessKey",
	"noAriaHiddenOnFocusable",
	"noAutofocus",
	"noInteractiveElementToNoninteractiveRole",
	"noNoninteractiveElementToInteractiveRole",
	"noNoninteractiveTabindex",
	"noRedundantRoles",
	"useValidAriaProps",
	"useValidAriaRole",
	"noImportantStyles",
	"noConstAssign",
	"noProcessGlobal",
	"useJsonImportAttributes",
	"noUnusedPrivateClassMembers",
	"useExhaustiveDependencies",
	"noFloatingPromises",
	"noMisusedPromises",
	"useExhaustiveSwitchCases",
	"noEqualsToNull",
	"useConsistentArrayType",
	"useConsistentCurlyBraces",
	"useConsistentTestIt",
	"useRegexpTest",
	"useUnicodeRegex",
	"noNonNullAssertion",
	"useAtIndex",
	"noParametersOnlyUsedInRecursion",
	"noSkippedTests",
	"useNamingConvention",
];

function settingOf(rule: string): typeof RuleSetting.Type | undefined {
	return Object.values(preset.linter.rules).find((group) => group[rule] !== undefined)?.[rule];
}

describe("the Biome preset", () => {
	it.each(AUTHOR_REPAIRS)("keeps %s at error with its fix off, so the author decides the repair", (rule) => {
		expect(settingOf(rule)).toMatchObject({ fix: "none", level: "error" });
	});

	it("groups imports as builtins, packages, @shivaedev packages, aliases and same-folder paths", () => {
		expect(preset.assist.actions.source.organizeImports.options.groups).toEqual([
			[":NODE:", ":BUN:"],
			[":PACKAGE:", ":PACKAGE_WITH_PROTOCOL:", ":URL:", "!@shivaedev/**"],
			["@shivaedev/**"],
			[":ALIAS:"],
			[":PATH:"],
		]);
	});
});
