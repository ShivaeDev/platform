import { Effect } from "effect";
import { presetConfig } from "#adapters/biome/presetConfig.ts";
import { recommendedRules } from "#biome/recommendedRules.ts";
import { defineRule, type Finding, type Rule, type RuleInputs, type RuleServices } from "#rule.ts";
import { type Json, member, textOf } from "#rules/suppressions/biome/json.ts";

interface Setting {
	readonly level: string | undefined;
	readonly line: number | undefined;
}

function settingOf(rules: Json | undefined, rule: string): Setting {
	const [group = "", name = ""] = rule.split("/");
	const groupNode = member(rules, group);
	const severity = textOf(groupNode);
	if (severity !== undefined) {
		return { level: severity, line: groupNode?.line };
	}
	const node = member(groupNode, name);
	return { level: textOf(node) ?? textOf(member(node, "level")), line: node?.line };
}

const FIX = 'Set it to "error" in the preset and repair the code it reports.';

function looseRule(file: string, rule: string, { level, line }: Setting): Finding {
	const state = level === undefined ? "leaves at Biome's default level" : `sets to "${level}"`;
	return { file, line, message: `Biome recommends "lint/${rule}", which the preset ${state}. ${FIX}`, subject: `lint/${rule}` };
}

const check = Effect.fn("BiomeRecommended.check")(function* (inputs: Pick<RuleInputs, "readText">, recommended: Recommended) {
	const preset = yield* presetConfig(inputs.readText);
	if (preset._tag === "Skipped") {
		return [];
	}
	if (preset._tag === "Problem") {
		return preset.findings;
	}
	const { path } = preset;
	const declared = new Set(preset.declared.map((declaration) => declaration.rule));
	const rules = member(member(preset.json, "linter"), "rules");
	return (yield* recommended())
		.filter((rule) => !declared.has(`lint/${rule}`))
		.map((rule) => ({ rule, setting: settingOf(rules, rule) }))
		.filter(({ setting }) => setting.level !== "error")
		.map(({ rule, setting }) => looseRule(path, rule, setting));
});

type Recommended = () => Effect.Effect<readonly string[], unknown, RuleServices>;

export function biomeRecommendedFrom(recommended: Recommended): Rule<"suppressions/biome-recommended", undefined> {
	return defineRule({
		check: (inputs) => check(inputs, recommended),
		description:
			"Every recommended Biome rule without a shipped internal exception runs at error in the shared preset. Set missing rules to error in the preset and repair the code they report.",
		id: "suppressions/biome-recommended",
		needs: "child-process",
		registrable: false,
	});
}

export const biomeRecommended = biomeRecommendedFrom(recommendedRules);
