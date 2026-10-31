import { posix } from "node:path";
import { Effect } from "effect";
import { ChangesetError } from "#error.ts";
import type { WorkspacePackage } from "#model.ts";

function matchesChangelog(pattern: string): boolean {
	return posix.matchesGlob("CHANGELOG.md", pattern.replace(/^\.\//u, ""));
}

export const checkPackageFiles = Effect.fn("Changesets.checkPackageFiles")(function* (packages: readonly WorkspacePackage[]) {
	for (const { directory, manifest } of packages) {
		if (manifest.private || manifest.files === undefined) {
			continue;
		}
		const includes = manifest.files.filter((pattern) => !pattern.startsWith("!"));
		const excludes = manifest.files.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1));
		if (!includes.some(matchesChangelog) || excludes.some(matchesChangelog)) {
			return yield* new ChangesetError({
				message: `${manifest.name}: ${directory}/package.json files excludes CHANGELOG.md from the npm tarball. Add "CHANGELOG.md" to files and remove any pattern that excludes it.`,
			});
		}
	}
});
