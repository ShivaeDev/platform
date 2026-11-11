import { createRequire } from "node:module";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Path } from "effect";
import { PRESET } from "#adapters/biome/rootConfig.ts";
import { runBiome } from "#adapters/biome/run.ts";
import { decodeShipped, PRESET_DECLARATIONS } from "#rules/suppressions/biome/declarations.ts";
import { type Json, member, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";

const RECOMMENDED_ONLY = '{ "linter": { "rules": { "preset": "recommended" } } }\n';

const ENABLED_RULE = /^ {4}(?<rule>[a-z0-9]+\/\w+)$/gimu;

export const recommendedRules = Effect.fn("Biome.recommendedRules")(function* () {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

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

function levelOf(rules: Json | undefined, rule: string): string | undefined {
	const [group = "", name = ""] = rule.split("/");
	const node = member(member(rules, group), name);
	return textOf(member(rules, group)) ?? textOf(node) ?? textOf(member(node, "level"));
}

export const presetBelowError = Effect.fn("Biome.presetBelowError")(function* (recommended: readonly string[]) {
	const { dirname, join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const fs = yield* FileSystem.FileSystem;
	const path = createRequire(import.meta.url).resolve(PRESET);
	const preset = parseJsonc(path, yield* fs.readFileString(path));
	const declarations = decodeShipped(yield* fs.readFileString(join(dirname(path), PRESET_DECLARATIONS)));
	if (preset._tag !== "Parsed" || declarations._tag === "Invalid") {
		return yield* Effect.die(new Error(`Cannot read the preset shipped at ${path} or the declarations beside it`));
	}
	const declared = new Set(declarations.value.map((declaration) => declaration.rule));
	const rules = member(member(preset.json, "linter"), "rules");
	return recommended.flatMap((rule) => {
		const level = levelOf(rules, rule);
		return declared.has(`lint/${rule}`) || level === "error" ? [] : [`${rule}: ${level ?? "Biome's default level"}`];
	});
});
