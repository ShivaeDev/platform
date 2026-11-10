import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { vi } from "vitest";
import { isolatedGit } from "#server/adapters/isolatedGit.ts";
import { storyKit } from "#server/storyKit.ts";

const IDENTITY = ["-c", "user.name=Story", "-c", "user.email=story@example.com"];

function lines(text: string) {
	return text.split("\n").filter((line) => line !== "");
}

function inRepository(cwd: string, args: readonly string[], handed: Readonly<Record<string, string>> = {}) {
	const run = isolatedGit(cwd, args, handed);
	return run.status === 0 ? "done" : `refused: ${run.stderr.trim()}`;
}

export const gitRepository = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "isolated-git-story-" });
		const hooks = join(root, "refusing-hooks");
		const repository = join(root, "repository");
		const refusingConfig = join(root, "refusing.gitconfig");
		for (const folder of [hooks, repository]) {
			yield* fs.makeDirectory(folder);
		}
		yield* fs.writeFileString(join(hooks, "pre-commit"), "#!/bin/sh\necho 'the hostile hook refuses every commit' >&2\nexit 1\n");
		yield* fs.chmod(join(hooks, "pre-commit"), 0o755);
		yield* fs.writeFileString(refusingConfig, `[core]\n\thooksPath = ${hooks}\n`);
		yield* fs.writeFileString(join(repository, "README.md"), "story\n");
		yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
		const handed: Readonly<Record<string, string>> = {};
		return { handed, hooks, outer: join(root, "outer"), refusingConfig, repository };
	},
	layer: NodeServices.layer,
	name: "isolated git",
	stages: ["machine", "kit"],
	verbs: (engine, story) => ({
		commits: () =>
			Effect.sync(() => {
				story.tell("the kit commits README.md in a new repository through the isolated runner");
				for (const args of [
					["init", "--quiet"],
					["add", "README.md"],
					[...IDENTITY, "commit", "--quiet", "--message", "Add the README"],
				]) {
					const outcome = inRepository(engine.repository, args, engine.handed);
					if (outcome !== "done") {
						return outcome;
					}
				}
				return "committed";
			}),
		committedFiles: () => Effect.sync(() => lines(isolatedGit(engine.repository, ["ls-tree", "--name-only", "HEAD"]).stdout)),
		outerCommits: () => Effect.sync(() => lines(isolatedGit(engine.outer, ["log", "--format=%an, %cn: %s"]).stdout)),
		repositoryCommits: () => Effect.sync(() => lines(isolatedGit(engine.repository, ["log", "--format=%an, %cn: %s"]).stdout)),
	}),
});

export const refusingGlobalConfig = gitRepository.trait(
	"machine",
	"the developer's global Git config points core.hooksPath at a hook that refuses every commit",
	(engine) => {
		vi.stubEnv("GIT_CONFIG_GLOBAL", engine.refusingConfig);
	},
);

export const refusingSystemConfig = gitRepository.trait(
	"machine",
	"the machine's system Git config points core.hooksPath at a hook that refuses every commit",
	(engine) => {
		vi.stubEnv("GIT_CONFIG_SYSTEM", engine.refusingConfig);
	},
);

export const outerRepositoryHook = gitRepository.trait(
	"machine",
	"a hook of the outer repository, with one commit and outer.txt staged, runs the tests and exports its GIT_DIR, GIT_INDEX_FILE, the author and committer Outer Hook and a GIT_CONFIG_PARAMETERS that names the refusing hook",
	function* (engine) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(engine.outer);
		yield* fs.writeFileString(join(engine.outer, "outer.txt"), "outer\n");
		for (const args of [
			["init", "--quiet"],
			["-c", "user.name=Outer", "-c", "user.email=outer@example.com", "commit", "--quiet", "--allow-empty", "--message", "Outer commit"],
			["add", "outer.txt"],
		]) {
			const outcome = inRepository(engine.outer, args);
			if (outcome !== "done") {
				return yield* Effect.die(new Error(`git ${args.join(" ")} failed in the outer repository: ${outcome}`));
			}
		}
		vi.stubEnv("GIT_DIR", join(engine.outer, ".git"));
		vi.stubEnv("GIT_INDEX_FILE", join(engine.outer, ".git/index"));
		vi.stubEnv("GIT_AUTHOR_NAME", "Outer Hook");
		vi.stubEnv("GIT_COMMITTER_NAME", "Outer Hook");
		vi.stubEnv("GIT_CONFIG_PARAMETERS", `'core.hooksPath'='${engine.hooks}'`);
	},
);

export const handedRefusingGlobalConfig = gitRepository.trait(
	"kit",
	"the kit hands the runner a global Git config whose hook refuses every commit",
	(engine) => {
		engine.handed = { "GIT_CONFIG_GLOBAL": engine.refusingConfig };
	},
);
