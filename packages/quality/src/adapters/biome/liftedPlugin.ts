import { Effect, FileSystem } from "effect";
import { cacheConfig } from "#adapters/biome/cacheConfig.ts";

const EXEMPT = "(?:adapters|test-support)";

// The plugin's own file keeps the one definition of what is unsafe; this copy drops only adapters/ from its folder exemption, so its extra findings there are the evidence effect/adapter-bridges reads.
export const liftedPlugin = Effect.fn("Biome.liftedPlugin")(function* (root: string, path: string) {
	const text = yield* (yield* FileSystem.FileSystem).readFileString(path);
	if (!text.includes(EXEMPT)) {
		return yield* Effect.die(new Error(`${path} no longer exempts ${EXEMPT} by $filename, so Quality cannot lift its adapters/ exemption.`));
	}
	return yield* cacheConfig(root, text.replaceAll(EXEMPT, "(?:test-support)"), "grit");
});
