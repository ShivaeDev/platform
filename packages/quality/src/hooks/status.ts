import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Console, Effect } from "effect";
import { GateFailed, SetupFailure } from "#failure.ts";
import { git, gitOrFail } from "#git/command.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { type HookLocation, hookLocation } from "./location.ts";
import { isHookShim } from "./shim.ts";

function executable(file: string) {
	return Effect.promise(async () => {
		try {
			await access(file, constants.X_OK);
			return await realpath(file);
		} catch {
			return undefined;
		}
	});
}

export const globalHookStatus = Effect.fn("Hooks.globalHookStatus")(function* (location: HookLocation) {
	const global = yield* git(location.toplevel, ["config", "--global", "--type=path", "--get", "core.hooksPath"]);
	if (global.code !== 0 && global.code !== 1) {
		return yield* new SetupFailure({ message: `cannot read global core.hooksPath: ${global.stderr.trim()}` });
	}
	const path = global.stdout.trim();
	const hook = resolve(location.toplevel, path, "pre-commit");
	const target = path === "" ? undefined : yield* executable(hook);
	const own = yield* executable(location.file);
	yield* Console.log(
		target !== undefined && target !== own
			? `quality: chaining global pre-commit hook at ${hook}.`
			: "quality: no executable global pre-commit hook to chain.",
	);
});

export const hookStatus = Effect.fn("Hooks.hookStatus")(function* (cwd: string) {
	const location = yield* hookLocation(cwd);
	const path = (yield* gitOrFail(cwd, ["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"])).trim();
	const text = yield* readOptionalText(path).pipe(Effect.mapError((error) => new SetupFailure({ message: error.message })));
	if (text === undefined || !isHookShim(text) || (yield* executable(path)) === undefined) {
		yield* Console.error(
			`quality: the effective hooks path ${dirname(path)} does not run Quality's pre-commit hook.\nhelp: run \`quality hooks install\` to check commits.`,
		);
		return yield* new GateFailed();
	}
	yield* Console.log(`quality: git runs Quality's pre-commit hook at ${path}.`);
	yield* globalHookStatus(location);
});
