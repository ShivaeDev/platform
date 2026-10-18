import { fileURLToPath } from "node:url";
import { Effect, FileSystem } from "effect";
import { write } from "./fixture.ts";

export const installCommitGuard = Effect.fn("ChangesetsStory.installCommitGuard")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* write(root, ".git/absolute-paths", `${root}\n${fileURLToPath(new URL("../../../../", import.meta.url))}\n`);
	const guard =
		'#!/bin/sh\nif git grep --cached -I -F -f .git/absolute-paths; then\n  echo "Commit contains an absolute machine path" >&2\n  exit 1\nfi\n';
	for (const directory of ["hooks", "global-hooks"]) {
		yield* write(root, `.git/${directory}/pre-commit`, directory === "hooks" ? guard : `${guard}touch .git/global-hook-ran\n`);
		yield* fs.chmod(`${root}/.git/${directory}/pre-commit`, 0o755);
	}
	yield* write(root, ".git/story-global-config", `[core]\n\thooksPath = ${JSON.stringify(`${root}/.git/global-hooks`)}\n`);
});
