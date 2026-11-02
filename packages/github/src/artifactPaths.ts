import { Effect } from "effect";
import { GitHubArtifactDuplicateEntry, GitHubArtifactPathTraversal } from "#artifactErrors.ts";

const safeName = Effect.fnUntraced(function* (path: string, directory: boolean) {
	const name = directory && path.endsWith("/") ? path.slice(0, -1) : path;
	const segments = name.split("/");
	if (/[\\:\0]/u.test(name) || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
		return yield* new GitHubArtifactPathTraversal({ path });
	}
	return { name, segments };
});

export function artifactPaths() {
	const entries = new Set<string>();
	const files = new Set<string>();
	const directories = new Set<string>();
	const registerParents = Effect.fnUntraced(function* (path: string, segments: readonly string[]) {
		for (let index = 1; index < segments.length; index += 1) {
			const parent = segments.slice(0, index).join("/");
			if (files.has(parent)) {
				return yield* new GitHubArtifactDuplicateEntry({ path });
			}
			directories.add(parent);
		}
	});
	return Effect.fnUntraced(function* (path: string, directory: boolean) {
		const { name, segments } = yield* safeName(path, directory);
		if (entries.has(name) || (!directory && directories.has(name))) {
			return yield* new GitHubArtifactDuplicateEntry({ path });
		}
		yield* registerParents(path, segments);
		entries.add(name);
		(directory ? directories : files).add(name);
		return name;
	});
}
