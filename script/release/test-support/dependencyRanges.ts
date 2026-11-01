import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { applyRelease } from "@shivaedev/releases/applyRelease.ts";
import config from "#release-config";
import { git } from "./git.ts";
import { repository } from "./repository.ts";

export function dependencyRange(field: string, range: string) {
	return repository.trait("pending", `work-fleet declares platform ${range} in ${field}`, function* ({ root }) {
		yield* (yield* FileSystem.FileSystem).writeFileString(
			join(root, "packages/work-fleet/package.json"),
			JSON.stringify({ [field]: { "@shivaedev/platform": range }, name: "@shivaedev/work-fleet", version: "0.3.0" }),
		);
		yield* Effect.sync(() => {
			git(root, "add", "packages/work-fleet/package.json");
			git(root, "commit", "--allow-empty", "-m", "Declare dependency range");
		});
	});
}

export const applied = repository.trait("pending", "the pending release is applied", ({ root }) => applyRelease(root, config).pipe(Effect.asVoid));
