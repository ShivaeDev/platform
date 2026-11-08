import { resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { readOptionalText } from "#inventory/filesystem.ts";
import type { RuleInputs } from "#rule.ts";

export const manifestReader = Effect.fn("Manifests.manifestReader")(function* (
	root: string,
): Effect.fn.Return<RuleInputs["readText"], never, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	return (path) => Effect.provideService(readOptionalText(resolve(root, path)), FileSystem.FileSystem, fs);
});
