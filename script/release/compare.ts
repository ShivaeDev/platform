import { Effect } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { git as releaseGit } from "./git.ts";

export const compareRelease = Effect.fn("Release.compareRelease")(function* (root: string, head: string) {
	if (head === "") {
		return undefined;
	}
	function git(...args: readonly string[]) {
		return releaseGit(root, ...args);
	}
	const path = (yield* git("log", "-1", "--format=", "--name-only", head, "--", "*/CHANGELOG.md")).split("\n")[0];
	const text = yield* git("show", `${head}:${path}`);
	const date = /^# Changelog\n\n## [^\n ]+ - (?<date>\d{4}-\d{2}-\d{2})\n/u.exec(text)?.groups?.date;
	if (date === undefined) {
		return yield* new ChangesetError({ message: "The standing release needs a dated changelog heading; rerun releases apply." });
	}
	return { base: yield* git("rev-parse", `${head}^`), date, tree: yield* git("rev-parse", `${head}^{tree}`) };
});
