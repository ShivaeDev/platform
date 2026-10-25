import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { commits, hookRepository, hookText, withWorktree } from "#quality-fixtures/hookRepository.ts";

export const appSetup = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const repository = hookRepository({ scripts: { typecheck: "exit 3" } });
				return { cwd: repository.root, repository };
			}),
			({ repository }) => Effect.sync(() => rmSync(repository.root, { force: true, recursive: true })),
		),
	name: "application setup",
	stages: ["repository"],
	verbs: (engine, story) => ({
		commit: () => {
			story.tell("commit the application");
			return commits(engine.cwd, "Checked");
		},
		hook: () => hookText(engine.repository),
		setup: () => {
			story.tell("set up the application's quality hook");
			return Effect.promise(() => runQuality(engine.cwd, "setup"));
		},
	}),
});

export const unversionedApp = appSetup.trait("repository", "the application has no Git repository", (engine) => {
	rmSync(join(engine.repository.root, ".git"), { recursive: true });
});

export const enclosedApp = appSetup.trait("repository", "the application is inside another repository", (engine) => {
	engine.cwd = join(engine.repository.root, "application");
	mkdirSync(engine.cwd);
});

export const worktreeApp = appSetup.trait("repository", "the application is a linked worktree", (engine) => {
	engine.cwd = withWorktree(engine.repository, "application", join(engine.repository.root, "linked"));
});
