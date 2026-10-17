import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { checkSkills } from "#checkSkills.ts";
import { hashSkill } from "#hashSkill.ts";
import { syncSkills } from "#syncSkills.ts";
import { runCli } from "./cli.ts";
import { makeFixture, readFile } from "./fixture.ts";

export const RUN_SYNC = "Run `shivaedev-skills sync` and commit the result.";
export const MANIFEST = ".agents/skills/.shivaedev-skills.json";

export const skills = storyKit({
	clock: "live",
	create: makeFixture,
	inspect: ({ installed, repo }) => ({ installed, repo }),
	layer: NodeServices.layer,
	name: "skills",
	stages: ["selected", "synced", "changed"],
	verbs: (engine, story) => {
		function sync() {
			story.tell("the repository syncs its selected skills");
			return syncSkills(engine.repo, engine.installed);
		}
		function check() {
			story.tell("the repository checks its shared skills");
			return checkSkills(engine.repo, engine.installed);
		}
		function cli(command: "sync" | "check") {
			return Effect.sync(() => {
				story.tell(`the repository runs shivaedev-skills ${command}`);
				return runCli(engine.repo, [command]);
			});
		}
		const resolve = Effect.fn("SkillsStory.resolve")(function* (file: string) {
			return (yield* Path.Path).join(engine.repo, file);
		});
		const link = Effect.fn("SkillsStory.link")(function* (name: string) {
			return yield* (yield* FileSystem.FileSystem).readLink(yield* resolve(`.claude/skills/${name}`));
		});
		return {
			cli: { check: () => cli("check"), sync: () => cli("sync") },
			repository: {
				check,
				checkFailure: () => Effect.flip(check()),
				exists: Effect.fn("SkillsStory.exists")(function* (file: string) {
					return yield* (yield* FileSystem.FileSystem).exists(yield* resolve(file));
				}),
				fileType: Effect.fn("SkillsStory.fileType")(function* (file: string) {
					return (yield* (yield* FileSystem.FileSystem).stat(yield* resolve(file))).type;
				}),
				link,
				linkIsMissing: (name: string) => Effect.asVoid(Effect.flip(link(name))),
				manifest: () => readFile(engine.repo, MANIFEST).pipe(Effect.map((content) => JSON.parse(content))),
				path: engine.repo,
				read: (file: string) => readFile(engine.repo, file),
				sourceHash: (name: string) => hashSkill(`${engine.installed.root}/skills/${name}`),
				sync,
				syncFailure: () => Effect.flip(sync()),
				version: () => engine.installed.version,
			},
		};
	},
});
