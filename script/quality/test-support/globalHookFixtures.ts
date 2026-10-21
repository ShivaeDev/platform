import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ISOLATED_ENV } from "#quality-fixtures/git.ts";
import { hookStory } from "./hookStory.ts";

export const RECORDING_COMMIT_MESSAGE = '#!/bin/sh\nprintf "%s\\n" "$@" >> commit-msg.log\ncat "$1" >> commit-msg.log\n';
export const RECORDING_PUSH = '#!/bin/sh\nprintf "%s\\n" "$@" >> pre-push.log\ncat >> pre-push.log\n';

// The depth limit bounds a broken shim's recursion so the regression fails without exhausting processes.
export const chainingPreCommit = [
	"#!/bin/sh",
	"export GUARD_DEPTH=$((GUARD_DEPTH + 1))",
	'[ "$GUARD_DEPTH" -lt 4 ] || exit 99',
	'hook="$(git rev-parse --git-common-dir)/hooks/pre-commit"',
	'if [ -x "$hook" ]; then "$hook" "$@"; fi',
	"",
].join("\n");

export function pushDestination() {
	return hookStory.trait("git", "a local push destination exists", (repository) => {
		const result = spawnSync("git", ["init", "--bare", join(repository.global, "remote.git")], { encoding: "utf8", env: ISOLATED_ENV });
		if (result.status !== 0) {
			throw new Error(result.stderr);
		}
	});
}
