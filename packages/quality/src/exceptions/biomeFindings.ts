import { Effect } from "effect";
import { biomeReport } from "#biome/report.ts";
import { withoutEntryPointImports } from "#biome/withoutEntryPointImports.ts";
import type { StaleRegistryEntry } from "#exceptions/registry.ts";
import type { Finding, RuleInputs } from "#rule.ts";

export const staleBiomeExceptions = Effect.fn("Exceptions.staleBiomeExceptions")(function* (inputs: RuleInputs) {
	const declarations = inputs.exceptions ?? [];
	const declared = declarations.flatMap(({ files, reason, rules }) =>
		rules.filter((rule) => /^biome\/(?:lint|assist)\//u.test(rule)).flatMap((rule) => files.map((file) => ({ file, reason, rule }))),
	);
	const texts = yield* Effect.forEach(declared, ({ file }) => Effect.promise(() => inputs.readText(file)), { concurrency: "unbounded" });
	const entries = declared.filter((_, index) => texts[index] !== undefined);
	if (entries.length === 0) {
		return [];
	}
	const exclusions = declarations.flatMap((entry) =>
		entry.rules.includes("biome/files/includes") ? [{ ...entry, rules: ["biome/files/includes"] as const }] : [],
	);
	const report = yield* biomeReport(inputs.root, ["check", "--no-errors-on-unmatched"], exclusions, [...new Set(entries.map(({ file }) => file))]);
	const diagnostics = yield* Effect.promise(() => withoutEntryPointImports(inputs.readText, report.diagnostics));
	return entries
		.filter(({ file, rule }) => !diagnostics.some((diagnostic) => diagnostic.location.path === file && `biome/${diagnostic.category}` === rule))
		.map(
			(entry): StaleRegistryEntry => ({
				entry,
				problem: `matches no finding. Remove this file/rule pair from exceptions in ${inputs.configFile ?? "quality.config.ts"}`,
			}),
		);
});

export async function missingBiomeFiles(inputs: RuleInputs): Promise<readonly Finding[]> {
	const paths = (inputs.exceptions ?? [])
		.filter((entry) => entry.rules.some((rule) => rule.startsWith("biome/") && rule !== "biome/files/includes"))
		.flatMap((entry) => entry.files);
	const checked = await Promise.all(
		[...new Set(paths)].map(async (file) =>
			(await inputs.readText(file)) === undefined
				? [{ file, message: `This Biome exception names a missing file. Remove it from exceptions in ${inputs.configFile ?? "quality.config.ts"}.` }]
				: [],
		),
	);
	return checked.flat();
}

export function biomeExceptionHint(files: readonly string[], rule: string, config = "quality.config.ts"): string {
	const entry = { files, reason: "Explain why this exception is permanent.", rules: [`biome/${rule}`] };
	return ` Move this setting into exceptions in ${config}: ${JSON.stringify(entry)}, and remove the setting from the Biome config.`;
}
