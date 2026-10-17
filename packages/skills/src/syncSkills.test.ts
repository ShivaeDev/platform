import { expect } from "@effect/vitest";
import { ALPHA, ALPHA_NOTES, BETA } from "#test/fixture.ts";
import { MANIFEST, skills } from "#test/skills.ts";
import { addedCopyFile, collidingSkills, editedCopy, localSkills, selected, selectionChangedTo, synced } from "#test/traits.ts";

skills.it("copies selected skills as real files with Claude links, version and hash", [selected("alpha")], function* ({ repository }) {
	yield* repository.sync();

	expect(yield* repository.read(".agents/skills/alpha/SKILL.md")).toBe(ALPHA);
	expect(yield* repository.read(".agents/skills/alpha/references/notes.md")).toBe(ALPHA_NOTES);
	expect(yield* repository.fileType(".agents/skills/alpha/SKILL.md")).toBe("File");
	expect(yield* repository.link("alpha")).toBe("../../.agents/skills/alpha");
	expect(yield* repository.read(".claude/skills/alpha/SKILL.md")).toBe(ALPHA);
	expect(yield* repository.exists(".agents/skills/beta")).toBe(false);
	expect(yield* repository.manifest()).toEqual({
		skills: { alpha: yield* repository.sourceHash("alpha") },
		version: "1.2.0",
	});
	yield* repository.check();
});

skills.it(
	"leaves local skills beside shared ones",
	[localSkills, selected("alpha", "beta"), synced, selectionChangedTo()],
	function* ({ repository }) {
		yield* repository.sync();

		expect(yield* repository.read(".agents/skills/own/SKILL.md")).toBe("# Own\n");
		expect(yield* repository.read(".claude/skills/local/SKILL.md")).toBe("# Local\n");
		expect(yield* repository.manifest()).toEqual({ skills: {}, version: "1.2.0" });
	},
);

skills.it(
	"removes a deselected skill listed in the manifest",
	[selected("alpha", "beta"), synced, selectionChangedTo("alpha")],
	function* ({ repository }) {
		yield* repository.sync();

		expect(yield* repository.exists(".agents/skills/beta")).toBe(false);
		yield* repository.linkIsMissing("beta");
		expect(Object.keys((yield* repository.manifest()).skills)).toEqual(["alpha"]);
		expect(yield* repository.read(".agents/skills/alpha/SKILL.md")).toBe(ALPHA);
	},
);

skills.it(
	"refuses unowned selected names in either agent directory before changing files",
	[collidingSkills, selected("alpha", "beta")],
	function* ({ repository }) {
		const error = yield* repository.syncFailure();

		expect(error.message).toContain("- .agents/skills/alpha\n- .claude/skills/beta\n");
		expect(error.message).toContain('Rename or remove these, or drop the skill from "shivaedevSkills"');
		expect(yield* repository.read(".agents/skills/alpha/SKILL.md")).toBe("# Our alpha\n");
		expect(yield* repository.read(".claude/skills/beta/SKILL.md")).toBe("# Our beta\n");
		expect(yield* repository.exists(".agents/skills/beta")).toBe(false);
		expect(yield* repository.exists(MANIFEST)).toBe(false);
	},
);

skills.it(
	"overwrites an edited managed copy",
	[selected("beta"), synced, editedCopy("beta", "# Edited\n"), addedCopyFile("beta", "extra.md", "added by hand\n")],
	function* ({ repository }) {
		yield* repository.sync();

		expect(yield* repository.read(".agents/skills/beta/SKILL.md")).toBe(BETA);
		expect(yield* repository.exists(".agents/skills/beta/extra.md")).toBe(false);
	},
);

skills.it("names shipped skills when a selected skill is unknown", [selected("alpha", "gamma")], function* ({ repository }) {
	const error = yield* repository.syncFailure();

	expect(error.message).toBe("@shivaedev/skills 1.2.0 has no skill named gamma. It ships: alpha, beta.");
	expect(yield* repository.exists(".agents/skills/alpha")).toBe(false);
});

skills.it("asks for a selection when package.json has none", [], function* ({ repository }) {
	const error = yield* repository.syncFailure();

	expect(error.message).toContain('selects no skills. Add the skills this repository uses, such as "shivaedevSkills": ["pr-description"].');
});
