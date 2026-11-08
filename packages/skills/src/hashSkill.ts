import { Effect, FileSystem, Path } from "effect";
import { sha256Hex } from "#adapters/sha256Hex.ts";

export const hashSkill = Effect.fn("Skills.hashSkill")(function* (folder: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const parts: Array<string | Uint8Array> = [];
	const entries = (yield* fs.readDirectory(folder, { recursive: true })).sort();
	for (const entry of entries) {
		const file = path.join(folder, entry);
		if ((yield* fs.stat(file)).type === "File") {
			parts.push(`${entry.split(path.sep).join("/")}\0`, yield* fs.readFile(file), "\0");
		}
	}
	return yield* sha256Hex(parts);
});
