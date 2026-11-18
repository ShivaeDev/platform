import { dirname, join } from "node:path";
import { Effect, FileSystem } from "effect";
import { readInstalled } from "@shivaedev/skills/installed.ts";
import { syncSkills } from "@shivaedev/skills/syncSkills.ts";
import { git } from "#release/test-support/git.ts";
import { repository } from "#release/test-support/repository.ts";

export const SYNCED_INSTRUCTIONS = "Instructions released in 0.9.1.\n";
export const PENDING_INSTRUCTIONS = "Instructions changed since 0.9.1.\n";

export const starterSkill = repository.trait(
	"pending",
	"the starter keeps the story-testing copy it synced from skills 0.9.1, and a changed story-testing awaits a release",
	function* ({ root }) {
		const fs = yield* FileSystem.FileSystem;
		const write = Effect.fn("ReleaseStarterSkill.write")(function* (relative: string, text: string) {
			yield* fs.makeDirectory(dirname(join(root, relative)), { recursive: true });
			yield* fs.writeFileString(join(root, relative), text);
		});
		yield* write("packages/skills/package.json", JSON.stringify({ name: "@shivaedev/skills", version: "0.9.1" }));
		yield* write("packages/skills/CHANGELOG.md", "# Changelog\n\n## 0.9.1\n\n### Fixed\n\n- Released behavior.\n");
		yield* write("packages/skills/skills/story-testing/SKILL.md", SYNCED_INSTRUCTIONS);
		yield* write(
			"examples/starter/package.json",
			'{"name":"@shivaedev/starter","private":true,"version":"0.0.0","packageManager":"pnpm@12.13.0","shivaedevSkills":["story-testing"]}\n',
		);
		yield* write(
			"examples/starter/published-versions.json",
			'{"@shivaedev/platform":"0.15.0","@shivaedev/skills":"0.9.1","@shivaedev/work-fleet":"0.3.0"}\n',
		);
		yield* syncSkills(join(root, "examples/starter"), yield* readInstalled(join(root, "packages/skills")));
		yield* write("packages/skills/skills/story-testing/SKILL.md", PENDING_INSTRUCTIONS);
		yield* write(".changeset/skills.md", '---\n"@shivaedev/skills": patch\n---\n\n### Changed\n\n- Changed story-testing instructions.\n');
		yield* Effect.sync(() => {
			git(root, "add", ".");
			git(root, "commit", "-m", "Starter skill and its pending change");
		});
	},
);
