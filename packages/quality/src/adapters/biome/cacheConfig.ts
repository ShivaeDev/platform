import { createHash } from "node:crypto";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";

export const cacheConfig = Effect.fn("Biome.cacheConfig")(function* (root: string, config: Readonly<Record<string, unknown>>) {
	const fs = yield* FileSystem.FileSystem;
	const text = JSON.stringify(config);
	const directory = join(root, "node_modules", ".cache", "quality", "biome");
	const path = join(directory, `${createHash("sha256").update(text).digest("hex")}.json`);
	if (!(yield* fs.exists(path))) {
		yield* fs.makeDirectory(directory, { recursive: true });
		yield* Effect.scoped(
			Effect.gen(function* () {
				const pending = yield* fs.makeTempFileScoped({ directory, prefix: ".write-" });
				yield* fs.writeFileString(pending, text);
				yield* fs.rename(pending, path);
			}),
		);
	}
	return path;
});
