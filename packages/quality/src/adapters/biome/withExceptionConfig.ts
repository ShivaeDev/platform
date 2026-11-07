import { join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { exceptionConfig } from "#biome/exceptionConfig.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { ignoredPaths } from "#inventory/trackedPaths.ts";
import { browserOverrides } from "./browserTargets.ts";
import { parseConfig, relocateConfig } from "./relocateConfig.ts";

export const withExceptionConfig = Effect.fn("Biome.withExceptionConfig")(function* <TValue, TError, TRequirements>(
	root: string,
	declarations: readonly ExceptionDeclaration[],
	run: (args: readonly string[]) => Effect.Effect<TValue, TError, TRequirements>,
	nonEffectFolders: readonly string[] = [],
) {
	const { includes, overrides } = exceptionConfig(declarations);
	const targets = yield* browserOverrides(root);
	const gitIgnored = (yield* ignoredPaths(root)) ?? [];
	const gitIgnores = gitIgnored.map((file) => `!${relative(root, file).replaceAll("\\", "/")}`);
	if (includes.length === 0 && overrides.length === 0 && nonEffectFolders.length === 0 && targets.length === 0 && gitIgnores.length === 0) {
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
	const files = Schema.is(Schema.Record(Schema.String, Schema.Unknown))(own.files) ? own.files : {};
	if (
		(own.files !== undefined && !Schema.is(Schema.Record(Schema.String, Schema.Unknown))(own.files))
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
		overrides: [...previousOverrides, ...overrides, ...targets],
	};
	const path = yield* relocateConfig(root, join(root, config), generated, nonEffectFolders);
	return yield* run([`--config-path=${path}`]);
});
