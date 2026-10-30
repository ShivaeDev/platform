import { dirname } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { SetupFailure } from "#failure.ts";
import { gitOrFail, run } from "#git/command.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { forwardingPath, removeForwarding } from "./forwarding.ts";
import { hookLocation } from "./location.ts";
import { isHookShim } from "./shim.ts";

export const uninstallHook = Effect.fn("Hooks.uninstallHook")(function* (cwd: string) {
	const fs = yield* FileSystem.FileSystem;
	const { file } = yield* hookLocation(cwd);
	const existing = yield* Effect.mapError(readOptionalText(file), (failure) => new SetupFailure({ cause: failure, message: failure.message }));
	if (existing === undefined) {
		return yield* Console.log(`quality: there is no pre-commit hook at ${file}.`);
	}
	if (!isHookShim(existing)) {
		return yield* Console.error(`quality: kept ${file}: it is not quality's pre-commit hook.`);
	}
	yield* Effect.mapError(fs.remove(file), (error) => new SetupFailure({ cause: error, message: `cannot remove ${file}: ${error.message}` }));
	const local = yield* run(cwd, ["config", "--local", "--get", "core.hooksPath"]);
	yield* removeForwarding(file).pipe(Effect.mapError((error) => new SetupFailure({ cause: error, message: error.message })));
	if ([dirname(file), forwardingPath(file)].includes(local.stdout.trim())) {
		yield* gitOrFail(cwd, ["config", "--local", "--unset-all", "core.hooksPath"]);
	}
	yield* Console.log(`quality: removed the pre-commit hook at ${file}.`);
});
