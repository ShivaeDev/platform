import type { Finding, RuleInputs } from "#rule.ts";

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
