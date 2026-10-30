import { resolve } from "node:path";
import { Effect, type FileSystem } from "effect";
import { readOptionalText } from "#inventory/filesystem.ts";
import type { RuleInputs } from "#rule.ts";

export const manifestReader = Effect.fn("Manifests.manifestReader")(function* (
	root: string,
): Effect.fn.Return<RuleInputs["readText"], never, FileSystem.FileSystem> {
	const services = yield* Effect.context<FileSystem.FileSystem>();
	return (path) => Effect.runPromiseWith(services)(readOptionalText(resolve(root, path)));
});
