import { posix } from "node:path";
import { recommendedRules } from "#biome/recommendedRules.ts";
import { defineRule, type Finding, type Rule, type RuleInputs } from "#rule.ts";
import { PRESET, rootConfig } from "#rules/biome.ts";
import { decodeShipped, PRESET_DECLARATIONS } from "#rules/suppressions/biome/declarations.ts";
import { type Json, member, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";
import { resolvePackage } from "#rules/suppressions/biome/resolve.ts";

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

const FIX = `Set it to "error" in the preset, or declare why not in its ${PRESET_DECLARATIONS}.`;

function looseRule(file: string, rule: string, { level, line }: Setting): Finding {
	const state = level === undefined ? "leaves at Biome's default level" : `sets to "${level}"`;
	return { file, line, message: `Biome recommends "lint/${rule}", which the preset ${state}. ${FIX}`, subject: `lint/${rule}` };
}

function problem(file: string, message: string): readonly Finding[] {
	return [{ file, message }];
}

async function check(readText: RuleInputs["readText"], recommended: () => Promise<readonly string[]>): Promise<readonly Finding[]> {
	const root = await rootConfig(readText);
	if (!root.extendsPreset) {
		return [];
	}
	const path = await resolvePackage(readText, PRESET);
	if (path === undefined) {
		return problem(root.path, `Cannot resolve "${PRESET}" from node_modules. Install @shivaedev/quality at the repository root.`);
	}
	const text = await readText(path);
	const parsed = text === undefined ? undefined : parseJsonc(path, text);
	if (parsed?._tag !== "Parsed") {
		return problem(path, `Cannot read the preset "${PRESET}": ${parsed?.reason ?? "the file does not exist"}.`);
	}
	const declarationsPath = posix.join(posix.dirname(path), PRESET_DECLARATIONS);
	const declarations = await decodeShipped(await readText(declarationsPath));
	if (declarations._tag === "Invalid") {
		return problem(declarationsPath, `Cannot read the declarations shipped with "${PRESET}": ${declarations.issues.join("; ")}.`);
	}
	const declared = new Set(declarations.value.map((declaration) => declaration.rule));
	const rules = member(member(parsed.json, "linter"), "rules");
	return (await recommended())
		.filter((rule) => !declared.has(`lint/${rule}`))
		.map((rule) => ({ rule, setting: settingOf(rules, rule) }))
		.filter(({ setting }) => setting.level !== "error")
		.map(({ rule, setting }) => looseRule(path, rule, setting));
}

export function biomeRecommendedFrom(recommended: () => Promise<readonly string[]>): Rule<"suppressions/biome-recommended", undefined> {
	return defineRule({
		check: ({ readText }) => check(readText, recommended),
		description:
			"Every rule the installed Biome recommends is at error in the shared preset, or the preset declares why not, so a Biome upgrade that adds or changes a recommended rule cannot slip in at Biome's default level.",
		id: "suppressions/biome-recommended",
		registrable: false,
	});
}

export const biomeRecommended = biomeRecommendedFrom(recommendedRules);
