import { join } from "node:path";
import { FileSystem, Schema } from "effect";
import { writeJson } from "#package-check/io.ts";
import { archives } from "./archives.ts";

const Inventory = Schema.fromJsonString(
	Schema.Struct({
		packages: Schema.Array(Schema.Struct({ name: Schema.String, sha256: Schema.String, version: Schema.String })),
		sha: Schema.String,
	}),
);

export function archiveInventory(problem: "commit" | "missing" | "version" | "checksum") {
	return archives.trait("archives", `the shared archives have a ${problem} mismatch`, function* ({ directory }) {
		const fs = yield* FileSystem.FileSystem;
		const path = join(directory, "manifest.json");
		const inventory = Schema.decodeUnknownSync(Inventory)(yield* fs.readFileString(path));
		if (problem === "checksum") {
			yield* fs.writeFileString(join(directory, "addon.tgz"), "changed");
			return;
		}
		yield* writeJson(path, {
			packages:
				problem === "missing" ? [] : inventory.packages.map((entry) => ({ ...entry, version: problem === "version" ? "2.0.0" : entry.version })),
			sha: problem === "commit" ? "other" : inventory.sha,
		});
	});
}
