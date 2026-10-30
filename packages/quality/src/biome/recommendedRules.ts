import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { runBiome } from "./run.ts";

const RECOMMENDED_ONLY = '{ "linter": { "rules": { "preset": "recommended" } } }\n';

const ENABLED_RULE = /^ {4}(?<rule>[a-z0-9]+\/\w+)$/gimu;

export const recommendedRules = Effect.fn("Biome.recommendedRules")(function* () {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({ prefix: "quality-biome-recommended-" });
			yield* fs.writeFileString(join(directory, "biome.json"), RECOMMENDED_ONLY);
			const rage = yield* runBiome(directory, ["rage", "--linter"]);
			const rules = [...rage.stdout.matchAll(ENABLED_RULE)].flatMap((match) => match.groups?.rule ?? []);
			if (rules.length === 0) {
				return yield* Effect.die(
					new Error(`biome rage --linter listed no enabled rules under the recommended preset:\n${[rage.stdout, rage.stderr].join("\n").trim()}`),
				);
			}
			return rules;
		}),
	);
});
