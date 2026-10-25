import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { type HookInstall, installHook } from "./install.ts";

export const setupHook = Effect.fn("Hooks.setupHook")(function* (options: Omit<HookInstall, "force">) {
	const fs = yield* FileSystem.FileSystem;
	if (yield* fs.exists(join(options.cwd, ".git"))) {
		yield* installHook({ ...options, force: false });
	}
});
