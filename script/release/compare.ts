import { execFileSync, spawnSync } from "node:child_process";
import { Effect, Schema } from "effect";
import { ReleaseManifest } from "@shivaedev/changesets/model.ts";

export const compareRelease = Effect.fn("Release.compareRelease")(function* (root: string, head: string) {
	if (head === "") {
		return undefined;
	}
	return yield* Effect.sync(() => {
		const merge = spawnSync("git", ["-C", root, "merge-tree", "--write-tree", "origin/main", head], { encoding: "utf8" });
		if (merge.error !== undefined) {
			throw merge.error;
		}
		if (merge.status === 1) {
			return undefined;
		}
		if (merge.status !== 0) {
			throw new Error(`Cannot compare the standing release: ${merge.stderr}`);
		}
		const text = execFileSync("git", ["-C", root, "show", `${head}:.changeset/release.json`], { encoding: "utf8", stdio: "pipe" });
		const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(ReleaseManifest))(text);
		return { date: manifest.date, tree: merge.stdout.trim() };
	});
});
