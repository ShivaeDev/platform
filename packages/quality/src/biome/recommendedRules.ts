import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBiome } from "./run.ts";

const RECOMMENDED_ONLY = '{ "linter": { "rules": { "preset": "recommended" } } }\n';

const ENABLED_RULE = /^ {4}(?<rule>[a-z0-9]+\/\w+)$/gimu;

export async function recommendedRules(): Promise<readonly string[]> {
	const directory = await mkdtemp(join(tmpdir(), "quality-biome-recommended-"));
	try {
		await writeFile(join(directory, "biome.json"), RECOMMENDED_ONLY);
		const rage = await runBiome(directory, ["rage", "--linter", `--config-path=${directory}`]);
		const rules = [...rage.stdout.matchAll(ENABLED_RULE)].flatMap((match) => match.groups?.rule ?? []);
		if (rules.length === 0) {
			throw new Error(`biome rage --linter listed no enabled rules under the recommended preset:\n${[rage.stdout, rage.stderr].join("\n").trim()}`);
		}
		return rules;
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}
