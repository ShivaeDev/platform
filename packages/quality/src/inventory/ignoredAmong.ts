import { join, posix } from "node:path";
import { Effect } from "effect";
import { emptyScope, verdictFor, withIgnoreFile } from "#inventory/ignoreScope.ts";
import { gitIgnoredAmong } from "#inventory/trackedPaths.ts";
import type { RuleInputs } from "#rule.ts";

const ignoredByIgnoreFiles = Effect.fn("Inventory.ignoredByIgnoreFiles")(function* (inputs: RuleInputs, path: string) {
	let scope = emptyScope;
	let directory = "";
	for (const part of path.split("/")) {
		const contents = yield* inputs.readText(posix.join(directory, ".gitignore"));
		scope = contents === undefined || contents === "" ? scope : withIgnoreFile(scope, join(inputs.root, directory), contents);
		directory = posix.join(directory, part);
		if (verdictFor(scope, join(inputs.root, directory), directory !== path) === "ignored") {
			return true;
		}
	}
	return false;
});

// Without Git, the .gitignore files from the root down decide, as they decide which files the inventory lists.
export const ignoredAmong = Effect.fn("Inventory.ignoredAmong")(function* (inputs: RuleInputs, paths: readonly string[]) {
	const byGit = yield* gitIgnoredAmong(inputs.root, paths);
	if (byGit !== undefined) {
		return byGit;
	}
	const ignored = yield* Effect.filter(paths, (path) => ignoredByIgnoreFiles(inputs, path));
	return ignored.map((path) => join(inputs.root, path));
});
