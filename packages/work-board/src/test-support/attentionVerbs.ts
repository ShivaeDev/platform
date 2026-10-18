import { chmodSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { fullIndex } from "./fullIndex.ts";
import { inboxFixture } from "./inboxFixture.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function attentionVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		readAttention: (files: Readonly<Record<string, string>> = inboxFixture(), unavailable: readonly string[] = []) =>
			Effect.gen(function* () {
				tell(`the reader checks attention after an outside edit to ${Object.keys(files).join(", ")}`);
				for (const entry of readdirSync(engine.notes.root, { recursive: true, withFileTypes: true })) {
					if (entry.isFile() && entry.name.endsWith(".md")) {
						rmSync(join(entry.parentPath, entry.name));
					}
				}
				Object.entries(files).forEach(([path, source], index) => {
					engine.notes.write(path, source);
					utimesSync(join(engine.notes.root, path), index, index);
				});
				for (const path of unavailable) {
					engine.notes.write(path, "# Unreadable project source");
					chmodSync(join(engine.notes.root, path), 0o000);
				}
				try {
					return yield* fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer));
				} finally {
					for (const path of unavailable) {
						chmodSync(join(engine.notes.root, path), 0o644);
					}
				}
			}),
	};
}
