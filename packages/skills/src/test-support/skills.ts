import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Option, Path } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runCli } from "./cli.ts";
import { type Fixture, makeFixture } from "./fixture.ts";
import { operations } from "./operations.ts";
import { pushedCommit, runStep, workflow } from "./workflow.ts";

export const MANIFEST = ".agents/skills/.shivaedev-skills.json";

export function outOfSync(...problems: readonly string[]) {
	return `failed: The shared skills are out of sync:\n${problems.map((problem) => `- ${problem}`).join("\n")}\nRun \`shivaedev-skills sync\` and commit the result.`;
}

const entryOf = Effect.fn("SkillsStory.entryOf")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const info = yield* fs.lstat(file);
	if (info.type === "SymbolicLink") {
		return `link to ${yield* fs.readLink(file)}`;
	}
	return info.type === "File" ? yield* fs.readFileString(file) : undefined;
});

const namesIn = Effect.fn("SkillsStory.namesIn")(function* (folder: string) {
	const fs = yield* FileSystem.FileSystem;
	return (yield* fs.exists(folder)) ? (yield* fs.readDirectory(folder)).filter((name) => !name.startsWith(".")).sort() : [];
});

function verbs(engine: Fixture, tell: (line: string) => void) {
	const resolve = Effect.fn("SkillsStory.resolve")(function* (file: string) {
		return (yield* Path.Path).join(engine.repo, file);
	});
	const folder = Effect.fn("SkillsStory.folder")(function* (relative: string) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* resolve(relative);
		const top = yield* fs.lstat(root).pipe(
			Effect.map(Option.some),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(Option.none()),
			),
		);
		if (Option.isSome(top) && top.value.type === "SymbolicLink") {
			return `link to ${yield* fs.readLink(root)}`;
		}
		if (Option.isNone(top)) {
			return "missing";
		}
		const files: Record<string, string> = {};
		for (const entry of (yield* fs.readDirectory(root, { recursive: true })).sort()) {
			const content = yield* entryOf(path.join(root, entry));
			if (content !== undefined) {
				files[entry.split(path.sep).join("/")] = content;
			}
		}
		return files;
	});
	function remote() {
		if (engine.remote === undefined) {
			throw new Error("Declare pullRequestBranch before reading what was pushed");
		}
		return engine.remote;
	}
	return {
		...operations(engine, tell),
		cli: {
			check: () =>
				Effect.sync(() => {
					tell("the repository runs shivaedev-skills check");
					return runCli(engine.repo, ["check"]);
				}),
			sync: () =>
				Effect.sync(() => {
					tell("the repository runs shivaedev-skills sync");
					return runCli(engine.repo, ["sync"]);
				}),
		},
		folder,
		installedVersion: () => engine.installed.version,
		manifest: Effect.fn("SkillsStory.manifest")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const file = yield* resolve(MANIFEST);
			return (yield* fs.exists(file)) ? JSON.parse(yield* fs.readFileString(file)) : "missing";
		}),
		skillFolders: Effect.fn("SkillsStory.skillFolders")(function* () {
			return {
				".agents/skills": yield* namesIn(yield* resolve(".agents/skills")),
				".claude/skills": yield* namesIn(yield* resolve(".claude/skills")),
			};
		}),
		workflow: {
			...workflow,
			pushedCommit: () => Effect.sync(() => pushedCommit(remote())),
			runs: (step: string) => {
				tell(`the sync workflow runs its step: ${step}`);
				return runStep(engine.repo, step);
			},
		},
	};
}

export const skills = storyKit({
	clock: "live",
	create: makeFixture,
	inspect: ({ installed, repo, selection }) => ({ installed, repo, selection }),
	layer: NodeServices.layer,
	name: "skills",
	stages: ["selected", "owned", "synced", "changed", "pushed"],
	verbs: (engine, story) => verbs(engine, story.tell),
});
