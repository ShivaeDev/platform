import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";

const repository = process.cwd();
const cli = join(repository, "packages/changesets/src/cli.ts");

function git(root: string, ...args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

const create = Effect.fn("ReleaseStory.create")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "platform-release-" });
	const files = [
		"package.json",
		".changeset",
		"script/release/platformHook.ts",
		"packages/changesets/src",
		"examples/starter/published-versions.json",
		"packages/work-board/src/server/packageInfo.ts",
		"packages/work-fleet/src/packageInfo.ts",
	];
	for (const parent of ["packages", "examples"]) {
		for (const name of yield* fs.readDirectory(join(repository, parent))) {
			for (const file of ["package.json", "CHANGELOG.md"]) {
				const relative = `${parent}/${name}/${file}`;
				if (yield* fs.exists(join(repository, relative))) {
					files.push(relative);
				}
			}
		}
	}
	for (const relative of files) {
		yield* fs.makeDirectory(join(root, relative, ".."), { recursive: true });
		yield* fs.copy(join(repository, relative), join(root, relative));
	}
	yield* fs.symlink(join(repository, "node_modules"), join(root, "node_modules"));
	yield* Effect.sync(() => {
		git(root, "init", "-b", "main");
		git(root, "config", "user.email", "release@example.test");
		git(root, "config", "user.name", "Release Stories");
		git(root, "add", ".");
		git(root, "commit", "-m", "Workspace before release");
	});
	return { root };
});

export const platform = storyKit({
	clock: "live",
	create,
	layer: NodeServices.layer,
	name: "Platform release",
	stages: ["pending"],
	verbs: ({ root }, story) => ({
		check: () => Effect.sync(() => spawnSync("env", ["CHANGELOG_BASE_REF=", "pnpm", "changelog:check", "main"], { cwd: root, encoding: "utf8" })),
		cli: (...args: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`changesets ${args.join(" ")}`);
				return spawnSync(process.execPath, ["--conditions=source", cli, ...args], { cwd: root, encoding: "utf8" });
			}),
		read: Effect.fn("ReleaseStory.read")(function* (relative: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, relative));
		}),
	}),
});

export const pending = platform.trait("pending", "framework and binary changes await a release", function* ({ root }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(
		join(root, ".changeset/release-story.md"),
		'---\n"@shivaedev/platform": patch\n"@shivaedev/create-app": patch\n"@shivaedev/work-board": patch\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Release story behavior.\n',
	);
});
