import { resolve } from "node:path";
import { Effect, type FileSystem, type Scope } from "effect";
import { readOptionalText } from "#inventory/filesystem.ts";
import type { RuleInputs } from "#rule.ts";

export const manifestReader = Effect.fn("Manifests.manifestReader")(function* (
	root: string,
): Effect.fn.Return<RuleInputs["readText"], never, FileSystem.FileSystem | Scope.Scope> {
	const services = yield* Effect.context<FileSystem.FileSystem>();
	const signal = yield* Effect.abortSignal;
	return (path) => Effect.runPromiseWith(services)(readOptionalText(resolve(root, path)), { signal });
});
