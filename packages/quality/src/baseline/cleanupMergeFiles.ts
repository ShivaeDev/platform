import { resolve } from "node:path";
import { Clock, Effect, FileSystem, Option } from "effect";
import { SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";

const STALE_AFTER_MS = 5 * 60_000;

export const cleanupMergeFiles = Effect.fn("Baseline.cleanupMergeFiles")(
	function* (cwd: string, inputs: readonly string[]) {
		const fs = yield* FileSystem.FileSystem;
		const root = (yield* gitOrFail(cwd, ["rev-parse", "--show-toplevel"])).trim();
		const active = new Set(inputs.map((path) => resolve(cwd, path)));
		const untracked = yield* gitOrFail(root, ["ls-files", "--others", "--full-name", "-z", "--", ":(top,glob).merge_file_*"]);
		const cutoff = (yield* Clock.currentTimeMillis) - STALE_AFTER_MS;
		for (const name of untracked.split("\0").filter(Boolean)) {
			const path = resolve(root, name);
			if (active.has(path)) {
				continue;
			}
			const info = yield* fs.stat(path);
			if (info.type === "File" && Option.exists(info.mtime, (mtime) => mtime.getTime() < cutoff)) {
				yield* fs.remove(path);
			}
		}
	},
	Effect.mapError((failure) => new SetupFailure({ cause: failure, message: failure.message })),
);
