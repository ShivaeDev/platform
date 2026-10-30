import { Console, Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";
import { hookCommand, type Launch, shellWords } from "#hooks/command.ts";

export const installDriver = Effect.fn("Baseline.installDriver")(function* (
	cwd: string,
	launch: Launch,
): Effect.fn.Return<void, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	const root = (yield* gitOrFail(cwd, ["rev-parse", "--show-toplevel"])).trim();
	const command = hookCommand(root, launch, undefined);
	const driver = `${shellWords([...command.runner, command.launcher, "baseline", "merge"])} "%O" "%A" "%B"`;
	yield* gitOrFail(root, ["config", "--local", "merge.quality-baseline.driver", driver]);
	yield* Console.log("quality: configured the repository-local quality-baseline merge driver.");
});
