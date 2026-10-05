import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { afterEach } from "vitest";
import { checkSkills } from "#checkSkills.ts";
import { hashSkill } from "#hashSkill.ts";
import { syncSkills } from "#syncSkills.ts";
import { ALPHA, ALPHA_NOTES, BETA, exists, it, readFile, removeFixtures, select, writeFile } from "#test/fixture.ts";

afterEach(removeFixtures);

const MANIFEST = ".agents/skills/.shivaedev-skills.json";

it("copies each selected skill as real files, links it from .claude/skills and records the version and its hash", function* ({ installed, repo }) {
	const fs = yield* FileSystem.FileSystem;
	yield* select(repo, ["alpha"]);

	yield* syncSkills(repo, installed);

	expect(yield* readFile(repo, ".agents/skills/alpha/SKILL.md")).toBe(ALPHA);
	expect(yield* readFile(repo, ".agents/skills/alpha/references/notes.md")).toBe(ALPHA_NOTES);
	expect((yield* fs.stat(`${repo}/.agents/skills/alpha/SKILL.md`)).type).toBe("File");
	expect(yield* fs.readLink(`${repo}/.claude/skills/alpha`)).toBe("../../.agents/skills/alpha");
	expect(yield* readFile(repo, ".claude/skills/alpha/SKILL.md")).toBe(ALPHA);
	expect(yield* exists(repo, ".agents/skills/beta")).toBe(false);
	expect(JSON.parse(yield* readFile(repo, MANIFEST))).toEqual({
		skills: { alpha: yield* hashSkill(`${installed.root}/skills/alpha`) },
		version: "1.2.0",
	});
	yield* checkSkills(repo, installed);
});

it("leaves the repository's own skills beside the shared ones", function* ({ installed, repo }) {
	yield* writeFile(".agents/skills/own/SKILL.md", "# Own\n")(repo);
	yield* writeFile(".claude/skills/local/SKILL.md", "# Local\n")(repo);
	yield* select(repo, ["alpha", "beta"]);
	yield* syncSkills(repo, installed);

	yield* select(repo, []);
	yield* syncSkills(repo, installed);

	expect(yield* readFile(repo, ".agents/skills/own/SKILL.md")).toBe("# Own\n");
	expect(yield* readFile(repo, ".claude/skills/local/SKILL.md")).toBe("# Local\n");
	expect(JSON.parse(yield* readFile(repo, MANIFEST))).toEqual({ skills: {}, version: "1.2.0" });
});

it("removes a skill that is deselected but still listed in the manifest", function* ({ installed, repo }) {
	yield* select(repo, ["alpha", "beta"]);
	yield* syncSkills(repo, installed);

	yield* select(repo, ["alpha"]);
	yield* syncSkills(repo, installed);

	expect(yield* exists(repo, ".agents/skills/beta")).toBe(false);
	const fs = yield* FileSystem.FileSystem;
	expect(yield* Effect.exit(fs.readLink(`${repo}/.claude/skills/beta`))).toMatchObject({ _tag: "Failure" });
	expect(Object.keys(JSON.parse(yield* readFile(repo, MANIFEST)).skills)).toEqual(["alpha"]);
	expect(yield* readFile(repo, ".agents/skills/alpha/SKILL.md")).toBe(ALPHA);
});

it("refuses a folder or link of a selected name that the manifest does not list, and changes nothing", function* ({ installed, repo }) {
	yield* writeFile(".agents/skills/alpha/SKILL.md", "# Our alpha\n")(repo);
	yield* writeFile(".claude/skills/beta/SKILL.md", "# Our beta\n")(repo);
	yield* select(repo, ["alpha", "beta"]);

	const error = yield* Effect.flip(syncSkills(repo, installed));

	expect(error.message).toContain("- .agents/skills/alpha\n- .claude/skills/beta\n");
	expect(error.message).toContain('Rename or remove these, or drop the skill from "shivaedevSkills"');
	expect(yield* readFile(repo, ".agents/skills/alpha/SKILL.md")).toBe("# Our alpha\n");
	expect(yield* readFile(repo, ".claude/skills/beta/SKILL.md")).toBe("# Our beta\n");
	expect(yield* exists(repo, ".agents/skills/beta")).toBe(false);
	expect(yield* exists(repo, MANIFEST)).toBe(false);
});

it("overwrites an edited copy of a skill it synced before", function* ({ installed, repo }) {
	yield* select(repo, ["beta"]);
	yield* syncSkills(repo, installed);
	yield* writeFile(".agents/skills/beta/SKILL.md", "# Edited\n")(repo);
	yield* writeFile(".agents/skills/beta/extra.md", "added by hand\n")(repo);

	yield* syncSkills(repo, installed);

	expect(yield* readFile(repo, ".agents/skills/beta/SKILL.md")).toBe(BETA);
	expect(yield* exists(repo, ".agents/skills/beta/extra.md")).toBe(false);
});

it("names the shipped skills when the selection names one the package lacks", function* ({ installed, repo }) {
	yield* select(repo, ["alpha", "gamma"]);

	const error = yield* Effect.flip(syncSkills(repo, installed));

	expect(error.message).toBe("@shivaedev/skills 1.2.0 has no skill named gamma. It ships: alpha, beta.");
	expect(yield* exists(repo, ".agents/skills/alpha")).toBe(false);
});

it("asks for a selection when package.json has none", function* ({ installed, repo }) {
	yield* writeFile("package.json", '{ "name": "consumer" }\n')(repo);

	const error = yield* Effect.flip(syncSkills(repo, installed));

	expect(error.message).toContain('selects no skills. Add the skills this repository uses, such as "shivaedevSkills": ["pr-description"].');
});
