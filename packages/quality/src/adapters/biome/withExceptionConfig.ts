import { join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { browserOverrides } from "#adapters/biome/browserTargets.ts";
import { parseConfig, relocateConfig } from "#adapters/biome/relocateConfig.ts";
import { exceptionConfig, type RulesOff } from "#biome/exceptionConfig.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { ignoredPaths } from "#inventory/trackedPaths.ts";

const isObject = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

// A group the config sets by one severity keeps it; the rules it would turn off then still run, and their findings are left to the scanner half.
function linterWithRulesOff(linter: unknown, off: RulesOff): unknown {
	const own = isObject(linter) ? linter : {};
	const ownRules = isObject(own.rules) ? own.rules : {};
	const groups = Object.entries(off).map(([group, names]) => {
		const ownGroup = ownRules[group];
		return [group, typeof ownGroup === "string" ? ownGroup : { ...(isObject(ownGroup) ? ownGroup : {}), ...names }];
	});
	return groups.length === 0 ? linter : { ...own, rules: { ...ownRules, ...Object.fromEntries(groups) } };
}

export const withExceptionConfig = Effect.fn("Biome.withExceptionConfig")(function* <TValue, TError, TRequirements>(
	root: string,
	declarations: readonly ExceptionDeclaration[],
	run: (args: readonly string[]) => Effect.Effect<TValue, TError, TRequirements>,
	nonEffectFolders: readonly string[] = [],
) {
	const { includes, overrides, rules } = exceptionConfig(declarations);
	const targets = yield* browserOverrides(root);
	const gitIgnored = (yield* ignoredPaths(root)) ?? [];
	const gitIgnores = gitIgnored.map((file) => `!${relative(root, file).replaceAll("\\", "/")}`);
	if (
		includes.length === 0
		&& overrides.length === 0
		&& Object.keys(rules).length === 0
		&& nonEffectFolders.length === 0
		&& targets.length === 0
		&& gitIgnores.length === 0
	) {
		return yield* run([]);
	}
	const { config, text } = yield* Effect.gen(function* () {
		for (const candidate of ["biome.json", "biome.jsonc"]) {
			const content = yield* readOptionalText(join(root, candidate));
			if (content !== undefined) {
				return { config: candidate, text: content };
			}
		}
		return { config: "biome.json", text: "{}" };
	});
	const own = yield* parseConfig(config, text);
	const files = isObject(own.files) ? own.files : {};
	if (
		(own.files !== undefined && !isObject(own.files))
		|| (files.includes !== undefined && !Array.isArray(files.includes))
		|| (own.overrides !== undefined && !Array.isArray(own.overrides))
	) {
		return yield* Effect.die(new Error(`Cannot merge exceptions into invalid ${config}: files, includes or overrides has the wrong shape.`));
	}
	const previousIncludes = Array.isArray(files.includes) ? files.includes : ["**"];
	const previousOverrides = Array.isArray(own.overrides) ? own.overrides : [];
	// Biome also matches a wildcard-led glob such as `!**/.worktrees` against the folders above the root, which ignores a whole linked worktree.
	const generated = {
		...own,
		files: {
			...files,
			includes: [...previousIncludes, ...includes.filter((pattern) => pattern !== "**"), ...gitIgnores, "!.worktrees"],
		},
		linter: linterWithRulesOff(own.linter, rules),
		overrides: [...previousOverrides, ...overrides, ...targets],
	};
	const path = yield* relocateConfig(root, join(root, config), generated, nonEffectFolders);
	return yield* run([`--config-path=${path}`]);
});
