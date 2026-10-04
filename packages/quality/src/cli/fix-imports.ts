import { join } from "node:path";
import { Effect, type FileSystem } from "effect";
import type { ResolvedConfig } from "../config/load.ts";
import { validOrFail } from "../decoded.ts";
import { readInput } from "../engine/baseline-file.ts";
import { ruleInputs } from "../engine/session.ts";
import { groupBy, type Violation } from "../engine/violation.ts";
import { applyRegistry, decodeRegistry } from "../exceptions/registry.ts";
import { SetupFailure } from "../failure.ts";
import { type Relocation, relocations } from "../imports/aliases/relocations.ts";
import { writeText } from "../inventory/filesystem.ts";
import { importsAliased } from "../rules/imports/aliased.ts";

export interface ImportRewrites {
	readonly files: number;
	readonly imports: number;
}

type Rewrite = Relocation & { readonly replacement: string };

function isRewrite(relocation: Relocation): relocation is Rewrite {
	return relocation.replacement !== undefined;
}

function rewritten(text: string, rewrites: readonly Rewrite[]): string {
	return rewrites
		.toSorted((left, right) => right.start - left.start)
		.reduce((result, { end, replacement, start }) => `${result.slice(0, start)}${replacement}${result.slice(end)}`, text);
}

// An import the registry excuses keeps its relative path, so the entry that excuses it stays in use.
function unexcused(config: ResolvedConfig, rewrites: readonly Rewrite[]): Effect.Effect<readonly Rewrite[], SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const raw = yield* readInput(config.root, config.registry);
		const registry = yield* validOrFail(config.registry, yield* Effect.promise(() => decodeRegistry(raw)));
		const pairs = rewrites.map((rewrite) => {
			const violation: Violation = { file: rewrite.file, level: "error", message: "", rule: importsAliased.id, subject: rewrite.specifier };
			return { rewrite, violation };
		});
		const kept = new Set(
			applyRegistry(
				pairs.map(({ violation }) => violation),
				registry,
				config,
			).kept,
		);
		return pairs.filter(({ violation }) => kept.has(violation)).map(({ rewrite }) => rewrite);
	});
}

export function rewriteImports(config: ResolvedConfig): Effect.Effect<ImportRewrites, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		if (!config.active.some((rule) => rule.id === importsAliased.id)) {
			return { files: 0, imports: 0 };
		}
		const inputs = yield* ruleInputs(config);
		const planned = yield* Effect.tryPromise({
			catch: (cause) => new SetupFailure({ message: `cannot plan the import rewrites: ${cause instanceof Error ? cause.message : String(cause)}` }),
			try: () => relocations(inputs),
		});
		const rewrites = yield* unexcused(config, planned.filter(isRewrite));
		const byFile = groupBy(rewrites, (rewrite) => rewrite.file);
		const changed = inputs.sources.flatMap((source) => {
			const edits = byFile.get(source.path);
			return edits === undefined ? [] : [{ path: source.path, text: rewritten(source.text, edits) }];
		});
		yield* Effect.forEach(changed, ({ path, text }) =>
			Effect.mapError(writeText(join(config.root, path), text), (failure) => new SetupFailure({ message: failure.message })),
		);
		return { files: changed.length, imports: rewrites.length };
	});
}
