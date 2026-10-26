import { execFileSync } from "node:child_process";
import { Effect } from "effect";

export const compareRelease = Effect.fn("Release.compareRelease")(function* (root: string, head: string) {
	if (head === "") {
		return undefined;
	}
	return yield* Effect.sync(() => {
		function git(...args: readonly string[]) {
			return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
		}
		const path = git("log", "-1", "--format=", "--name-only", head, "--", "*/CHANGELOG.md").split("\n")[0];
		const text = git("show", `${head}:${path}`);
		const date = /^# Changelog\n\n## [^\n ]+ - (?<date>\d{4}-\d{2}-\d{2})\n/u.exec(text)?.groups?.date;
		if (date === undefined) {
			throw new Error("The standing release needs a dated changelog heading; rerun changesets apply.");
		}
		return { base: git("rev-parse", `${head}^`), date, tree: git("rev-parse", `${head}^{tree}`) };
	});
});
