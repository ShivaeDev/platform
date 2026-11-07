import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Path } from "effect";
import { type HookInstall, installHook } from "#hooks/install.ts";

export const setupHook = Effect.fn("Hooks.setupHook")(function* (options: Omit<HookInstall, "force">) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const fs = yield* FileSystem.FileSystem;
	if (yield* fs.exists(join(options.cwd, ".git"))) {
		yield* installHook({ ...options, force: false });
	}
});
