import { execFileSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { command } from "./command.ts";
import { copyRepository } from "./copyRepository.ts";

const repository = process.cwd();

function git(root: string, ...args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

const create = Effect.fn("ReleaseStory.create")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "platform-release-" });
	yield* copyRepository(repository, root);
	yield* Effect.sync(() => {
		git(root, "init", "-b", "main");
		git(root, "config", "user.email", "release@example.test");
		git(root, "config", "user.name", "Release Stories");
		git(root, "add", ".");
		git(root, "commit", "-m", "Workspace before release");
	});
	const installed = yield* command(root, ["install", "--frozen-lockfile"]);
	if (installed.status !== 0) {
		return yield* Effect.fail(new Error(`Cannot install the release workspace: ${installed.stdout}\n${installed.stderr}`));
	}
	return { root };
});

export const platform = storyKit({
	clock: "live",
	create,
	layer: NodeServices.layer,
	name: "Platform release",
	stages: ["pending"],
	verbs: ({ root }, story) => ({
		read: Effect.fn("ReleaseStory.read")(function* (relative: string) {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, relative));
		}),
		run: Effect.fn("ReleaseStory.run")(function* (...args: readonly string[]) {
			const line = `pnpm ${args.join(" ")}`;
			story.tell(line);
			yield* Console.log(line);
			return yield* command(root, args);
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
