import { Console, Effect, FileSystem } from "effect";
import { SetupFailure } from "#failure.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { hookLocation } from "./location.ts";
import { isHookShim } from "./shim.ts";

export const uninstallHook = Effect.fn("Hooks.uninstallHook")(function* (cwd: string) {
	const fs = yield* FileSystem.FileSystem;
	const { file } = yield* hookLocation(cwd);
	const existing = yield* Effect.mapError(readOptionalText(file), (failure) => new SetupFailure({ message: failure.message }));
	if (existing === undefined) {
		return yield* Console.log(`quality: there is no pre-commit hook at ${file}.`);
	}
	if (!isHookShim(existing)) {
		return yield* Console.error(`quality: kept ${file}: it is not quality's pre-commit hook.`);
	}
	yield* Effect.mapError(fs.remove(file), (error) => new SetupFailure({ message: `cannot remove ${file}: ${error.message}` }));
	yield* Console.log(`quality: removed the pre-commit hook at ${file}.`);
});
