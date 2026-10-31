import { join, resolve } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { run } from "#git/command.ts";

const listedPaths = Effect.fn("Inventory.listedPaths")(function* (directory: string, options: readonly string[], path = ".") {
	const result = yield* run(directory, ["ls-files", "-z", ...options, "--", path]);
	if (result.code !== 0) {
		if (result.stderr.includes("not a git repository")) {
			return undefined;
		}
		return yield* new SetupFailure({ message: `git ls-files exited ${result.code}: ${result.stderr.trim()}` });
	}
	return result.stdout
		.split("\0")
		.filter(Boolean)
		.map((file) => join(directory, file));
});

export const trackedPaths = Effect.fn("Inventory.trackedPaths")(function* (directory: string, path = ".") {
	return (yield* listedPaths(directory, [], path)) ?? [];
});

export const ignoredTrackedPaths = Effect.fn("Inventory.ignoredTrackedPaths")(function* (directory: string) {
	return (yield* listedPaths(directory, ["--cached", "--ignored", "--exclude-standard"])) ?? [];
});

export const ignoredPaths = Effect.fn("Inventory.ignoredPaths")(function* (directory: string) {
	const paths = yield* listedPaths(directory, ["--others", "--ignored", "--exclude-standard", "--directory"]);
	return paths?.map((path) => resolve(path));
});
