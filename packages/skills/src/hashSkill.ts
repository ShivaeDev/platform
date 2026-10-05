import { createHash } from "node:crypto";
import { Effect, FileSystem, Path } from "effect";

export const hashSkill = Effect.fn("Skills.hashSkill")(function* (folder: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const hash = createHash("sha256");
	const entries = (yield* fs.readDirectory(folder, { recursive: true })).sort();
	for (const entry of entries) {
		const file = path.join(folder, entry);
		if ((yield* fs.stat(file)).type === "File") {
			hash.update(`${entry.split(path.sep).join("/")}\0`);
			hash.update(yield* fs.readFile(file));
			hash.update("\0");
		}
	}
	return hash.digest("hex");
});
