import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { installPreCommit } from "#lib/installPreCommit.ts";

const hooks = join(resolve(execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim()), "hooks");
if (installPreCommit(hooks) === "kept") {
	Effect.runSync(
		Effect.logWarning(`${join(hooks, "pre-commit")} is not Platform's, so it was kept. Call script/hooks/pre-commit from it to check commits.`),
	);
}
