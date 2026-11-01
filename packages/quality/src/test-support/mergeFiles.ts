import { readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "effect";
import { baselineStory } from "./baselineStory.ts";
import { git } from "./git.ts";
import { ALPHA_SHARD } from "./packageWorkspace.ts";
import { readOrUndefined, writeAll } from "./recordedDebt.ts";

export function mergeLeftovers() {
	return baselineStory.trait(
		"work",
		"the checkout has an old untracked merge input, a recent one, an old tracked one and unrelated old files",
		function* (engine) {
			const content = readOrUndefined(engine.root, ALPHA_SHARD) ?? "";
			writeAll(engine.root, [{ content, path: ".merge_file_tracked" }]);
			git(engine.root, "add", "--", ".merge_file_tracked");
			git(engine.root, "commit", "--quiet", "--message", "Track an author-owned merge file");
			const old = new Date((yield* Clock.currentTimeMillis) - 10 * 60_000);
			const paths = [".merge_file_stale", ".merge_file_tracked", "notes.txt", "packages/alpha/.merge_file_nested"];
			writeAll(
				engine.root,
				[...paths, ".merge_file_recent"].map((path) => ({ content, path })),
			);
			for (const path of paths) {
				utimesSync(join(engine.root, path), old, old);
			}
		},
	);
}

export function agedMergeInputs() {
	return baselineStory.trait("work", "the merge's three inputs have old timestamps before the driver starts", (engine) => {
		const bin = join(engine.root, "node_modules/.bin/quality");
		const script = readFileSync(bin, "utf8");
		writeFileSync(bin, script.replace("#!/bin/sh\n", '#!/bin/sh\ntouch -t 200001010000 "$3" "$4" "$5"\n'));
	});
}
