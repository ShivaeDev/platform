import { spawnSync } from "node:child_process";
import { Config, Effect, Option } from "effect";

// The pnpm on PATH can be older than the version the checkout pins, which pnpm switches to only for the command it runs.
// The generated app pins that same version, so its processes get the pnpm that runs the stories.
export function workspacePnpm() {
	return Option.getOrElse(Effect.runSync(Config.option(Config.String("npm_execpath"))), () =>
		spawnSync("which", ["pnpm"], { encoding: "utf8" }).stdout.trim(),
	);
}
