import { dirname, join } from "node:path";
import { Effect, FileSystem } from "effect";
import { SetupFailure } from "#failure.ts";
import { git } from "#git/command.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { shellWords } from "./command.ts";
import { isHookShim, OWNER } from "./shim.ts";

const HOOKS = [
	"applypatch-msg",
	"pre-applypatch",
	"post-applypatch",
	"pre-commit",
	"pre-merge-commit",
	"prepare-commit-msg",
	"commit-msg",
	"post-commit",
	"pre-rebase",
	"post-checkout",
	"post-merge",
	"pre-push",
	"pre-receive",
	"update",
	"proc-receive",
	"post-receive",
	"post-update",
	"reference-transaction",
	"push-to-checkout",
	"pre-auto-gc",
	"post-rewrite",
	"sendemail-validate",
	"fsmonitor-watchman",
	"p4-changelist",
	"p4-prepare-changelist",
	"p4-post-changelist",
	"p4-pre-submit",
	"post-index-change",
];

export function forwardingPath(file: string): string {
	return join(dirname(file), "quality");
}

export const globalHooksPath = Effect.fn("Hooks.globalHooksPath")(function* (cwd: string) {
	const global = yield* git(cwd, ["config", "--global", "--includes", "--type=path", "--get", "core.hooksPath"]);
	if (global.code !== 0 && global.code !== 1) {
		return yield* new SetupFailure({ message: `cannot read global core.hooksPath: ${global.stderr.trim()}` });
	}
	return global.stdout.trim();
});

function forwarder(file: string, name: string): string {
	return [
		"#!/bin/sh",
		OWNER,
		...(name === "pre-commit"
			? [`exec ${shellWords([file])} "$@"`]
			: [
					'global_path="$(git config --global --includes --type=path --get core.hooksPath)"',
					'[ -n "$global_path" ] || exit 0',
					`global_hook="$global_path/${name}"`,
					'if [ -x "$global_hook" ] && ! [ "$global_hook" -ef "$0" ]; then',
					'\texec "$global_hook" "$@"',
					"fi",
				]),
		"",
	].join("\n");
}

export const installForwarding = Effect.fn("Hooks.installForwarding")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = forwardingPath(file);
	yield* fs.makeDirectory(path, { recursive: true });
	for (const name of HOOKS) {
		const target = join(path, name);
		const existing = yield* readOptionalText(target);
		if (existing !== undefined && !isHookShim(existing)) {
			return yield* new SetupFailure({ message: `cannot replace ${target}: it is not Quality's hook.` });
		}
		yield* fs.writeFileString(target, forwarder(file, name));
		yield* fs.chmod(target, 0o755);
	}
	return path;
});

export const removeForwarding = Effect.fn("Hooks.removeForwarding")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = forwardingPath(file);
	for (const name of HOOKS) {
		const target = join(path, name);
		const existing = yield* readOptionalText(target);
		if (existing !== undefined && isHookShim(existing)) {
			yield* fs.remove(target);
		}
	}
	if ((yield* fs.exists(path)) && (yield* fs.readDirectory(path)).length === 0) {
		yield* fs.remove(path, { recursive: true });
	}
});
