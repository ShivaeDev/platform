import { execFileSync } from "node:child_process";
import { Effect, Schema } from "effect";
import { ReleaseManifest } from "@shivaedev/changesets/model.ts";

export const compareRelease = Effect.fn("Release.compareRelease")(function* (root: string, head: string) {
	if (head === "") {
		return undefined;
	}
	return yield* Effect.sync(() => {
		function git(...args: readonly string[]) {
			return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
		}
		const text = git("show", `${head}:.changeset/release.json`);
		const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(ReleaseManifest))(text);
		return { base: git("rev-parse", `${head}^`), date: manifest.date, tree: git("rev-parse", `${head}^{tree}`) };
	});
});
