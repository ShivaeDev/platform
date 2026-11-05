import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { checkSkills } from "@shivaedev/skills/checkSkills.ts";
import type { Installed } from "@shivaedev/skills/installed.ts";
import { syncSkills } from "@shivaedev/skills/syncSkills.ts";

export interface SkillsRepository {
	readonly root: string;
	skillsInstalled?: Installed;
	skillsRoot?: string;
}

export const SKILL_EXAMPLE = "export const View = (ready) => <div>{ready && <b />}</div>\n";
export const SKILL_MANIFEST = '{"version":"1.0.0","name":"example"}\n';

export const syncSkillFixture = Effect.fn("SkillDistribution.syncSkillFixture")(function* (engine: SkillsRepository, directory = ".") {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "quality-skills-" });
	const repo = path.join(engine.root, directory);
	yield* fs.makeDirectory(repo, { recursive: true });
	const installed: Installed = { root, skills: ["guide"], version: "1.0.0" };
	yield* fs.makeDirectory(path.join(root, "skills/guide/examples"), { recursive: true });
	for (const [file, content] of [
		["SKILL.md", "# Shared guide\n"],
		["examples/View.tsx", SKILL_EXAMPLE],
		["package.json", SKILL_MANIFEST],
	] as const) {
		yield* fs.writeFileString(path.join(root, "skills/guide", file), content);
	}
	yield* fs.writeFileString(path.join(repo, "package.json"), '{"name":"app","shivaedevSkills":["guide"],"type":"module"}\n');
	yield* syncSkills(repo, installed);
	engine.skillsInstalled = installed;
	engine.skillsRoot = repo;
}, Effect.provide(NodeServices.layer));

export function skillReadouts(engine: SkillsRepository) {
	return {
		skillsStatus: () => {
			if (engine.skillsInstalled === undefined) {
				return Effect.die(new Error("Sync the fixture's skills before checking their copies"));
			}
			return checkSkills(engine.skillsRoot ?? engine.root, engine.skillsInstalled).pipe(Effect.as("in sync"), Effect.provide(NodeServices.layer));
		},
	};
}
