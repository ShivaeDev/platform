import { biomeReport, type Diagnostic } from "../biome/report.ts";
import { defineRule, type Finding, type Rule, type RuleInputs } from "../rule.ts";
import { itemsOf, member, parseJsonc, textOf } from "./suppressions/biome/json.ts";

export const PRESET = "@shivaedev/quality/biome";

const ROOT_CONFIGS: readonly string[] = ["biome.json", "biome.jsonc"];

const FAILING: ReadonlySet<string> = new Set(["error", "fatal"]);

function messageOf(diagnostic: Diagnostic): string {
	return diagnostic.category === "format" && diagnostic.message.startsWith("Formatter would have printed")
		? "Is not formatted. Run `quality fix`."
		: diagnostic.message;
}

function findingOf(diagnostic: Diagnostic): Finding {
	const line = diagnostic.location.start?.line ?? 0;
	return {
		file: diagnostic.location.path ?? ".",
		line: line > 0 ? line : undefined,
		message: messageOf(diagnostic),
		subject: diagnostic.category ?? "internal",
	};
}

async function presetFinding(readText: RuleInputs["readText"]): Promise<readonly Finding[]> {
	const texts = await Promise.all(ROOT_CONFIGS.map(async (path) => ({ path, text: await readText(path) })));
	const found = texts.find((candidate) => candidate.text !== undefined);
	const parsed = found?.text === undefined ? undefined : parseJsonc(found.path, found.text);
	const extended = parsed?._tag === "Parsed" ? itemsOf(member(parsed.json, "extends")).map(textOf) : [];
	return extended.includes(PRESET)
		? []
		: [{ file: found?.path ?? "biome.json", message: `Extend "${PRESET}" from the root Biome config.`, subject: "preset" }];
}

const bridge = defineRule({
	check: async ({ readText, root }) => {
		const [preset, report] = await Promise.all([presetFinding(readText), biomeReport(root, ["check"])]);
		return [...preset, ...report.diagnostics.filter((diagnostic) => FAILING.has(diagnostic.severity)).map(findingOf)];
	},
	description: "Biome's lint, format and assist findings under the shared preset. `quality fix` applies the safe fixes and the formatting.",
	id: "biome",
	registrable: false,
});

export const biome: Rule<"biome", undefined> = { ...bridge, family: true };
