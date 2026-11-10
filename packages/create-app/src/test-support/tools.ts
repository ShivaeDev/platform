import { spawnSync } from "node:child_process";
import { Config, Effect, Option } from "effect";

// A developer's global or system Git configuration, such as a hooks path, commit signing or a commit template, must not change a story's result.
export const isolatedGit = ["GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null"] as const;

export function gitIn(folder: string, args: readonly string[], environment: readonly string[] = []) {
	return spawnSync("env", [...environment, ...isolatedGit, "git", ...args], { cwd: folder, encoding: "utf8" });
}

// The pnpm on PATH can be older than the version the checkout pins, which pnpm switches to only for the command it runs.
// The generated app pins that same version, so its processes get the pnpm that runs the stories.
export function workspacePnpm() {
	return Option.getOrElse(Effect.runSync(Config.option(Config.String("npm_execpath"))), () =>
		spawnSync("which", ["pnpm"], { encoding: "utf8" }).stdout.trim(),
	);
}
