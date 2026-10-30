import { NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Option, Path } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkSkills } from "#checkSkills.ts";
import { syncSkills } from "#syncSkills.ts";
import { runCli } from "./cli.ts";
import { type Fixture, makeFixture } from "./fixture.ts";
import { pushedCommit, runStep, workflow } from "./workflow.ts";

export const MANIFEST = ".agents/skills/.shivaedev-skills.json";

export function outOfSync(...problems: readonly string[]) {
	return `failed: The shared skills are out of sync:\n${problems.map((problem) => `- ${problem}`).join("\n")}\nRun \`shivaedev-skills sync\` and commit the result.`;
}

export const printedOrFailed = Effect.fn("SkillsStory.printedOrFailed")(function* (
	repo: string,
	operation: Effect.Effect<void, { readonly message: string }, FileSystem.FileSystem | Path.Path>,
) {
	const console = yield* Console.Console;
	const printed: string[] = [];
	const captured: Console.Console = {
		...console,
		log: (...parts) => {
			printed.push(parts.join(" "));
		},
	};
	return yield* operation.pipe(
		Effect.provideService(Console.Console, captured),
		Effect.match({
			onFailure: (error) => `failed: ${error.message.replaceAll(repo, "<repository>")}`,
			onSuccess: () => printed.join("\n"),
		}),
	);
});

const entryOf = Effect.fn("SkillsStory.entryOf")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const target = yield* Effect.option(fs.readLink(file));
	if (Option.isSome(target)) {
		return `link to ${target.value}`;
	}
	return (yield* fs.stat(file)).type === "File" ? yield* fs.readFileString(file) : undefined;
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
		const top = yield* Effect.option(fs.readLink(root));
		if (Option.isSome(top)) {
			return `link to ${top.value}`;
		}
		if (!(yield* fs.exists(root))) {
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
		check: () => {
			tell("the repository checks its shared skills");
			return printedOrFailed(engine.repo, checkSkills(engine.repo, engine.installed));
		},
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
		sync: () => {
			tell("the repository syncs its selection");
			return printedOrFailed(engine.repo, syncSkills(engine.repo, engine.installed));
		},
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
