import { Effect } from "effect";
import { biomeReport, type Diagnostic, FAILING } from "#biome/report.ts";
import { withoutEntryPointImports } from "#biome/withoutEntryPointImports.ts";
import { defineRule, type Finding, type Rule, type RuleInputs } from "#rule.ts";
import { itemsOf, member, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";

export const PRESET = "@shivaedev/quality/biome/preset.json";

const ROOT_CONFIGS: readonly string[] = ["biome.json", "biome.jsonc"];

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

interface RootConfig {
	readonly extendsPreset: boolean;
	readonly path: string;
}

export async function rootConfig(readText: RuleInputs["readText"]): Promise<RootConfig> {
	const texts = await Promise.all(ROOT_CONFIGS.map(async (path) => ({ path, text: await readText(path) })));
	const found = texts.find((candidate) => candidate.text !== undefined);
	const parsed = found?.text === undefined ? undefined : parseJsonc(found.path, found.text);
	const extended = parsed?._tag === "Parsed" ? itemsOf(member(parsed.json, "extends")).map(textOf) : [];
	return { extendsPreset: extended.includes(PRESET), path: found?.path ?? "biome.json" };
}

async function presetFinding(readText: RuleInputs["readText"]): Promise<readonly Finding[]> {
	const { extendsPreset, path } = await rootConfig(readText);
	return extendsPreset ? [] : [{ file: path, message: `Extend "${PRESET}" from the root Biome config.`, subject: "preset" }];
}

const bridge = defineRule({
	check: ({ exceptions, readText, root }) =>
		Effect.gen(function* () {
			const [preset, report] = yield* Effect.all([Effect.promise(() => presetFinding(readText)), biomeReport(root, ["check"], exceptions)], {
				concurrency: "unbounded",
			});
			const failing = report.diagnostics.filter((diagnostic) => FAILING.has(diagnostic.severity));
			return [...preset, ...(yield* Effect.promise(() => withoutEntryPointImports(readText, failing))).map(findingOf)];
		}),
	description:
		"Biome's lint, format and assist findings under the shared preset, except undeclared-dependency findings for a piece that an application's entry point brings. `quality fix` applies Biome's lint fixes, unsafe ones included, its assist actions and formatting.",
	id: "biome",
	registrable: false,
});

export const biome: Rule<"biome", undefined> = { ...bridge, family: true };
