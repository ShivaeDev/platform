import { expect } from "@effect/vitest";
import { skills } from "#test/skills.ts";
import { ownSkill, selected, synced, unreadable } from "#test/traits.ts";

for (const file of [".agents/skills/alpha", ".agents/skills/alpha/SKILL.md"]) {
	skills.it(`check reports unreadable ${file} as a permission failure`, [selected("alpha"), synced, unreadable(file)], function* ({ check }) {
		expect(yield* check()).toMatch(/^failed: PermissionDenied: FileSystem\./u);
	});
}

skills.it(
	"sync reports an unreadable selection with its read failure retained privately",
	[selected("alpha"), unreadable("package.json")],
	function* ({ failureDetails, sync }) {
		yield* sync();

		expect(yield* failureDetails()).toEqual({
			cause: { enumerable: false, message: expect.stringContaining("PermissionDenied:") },
			message: expect.stringContaining("Could not read <repository>/package.json: PermissionDenied:"),
		});
	},
);

skills.it(
	"sync reports unreadable ownership paths as permission failures",
	[selected("alpha"), ownSkill(".claude/skills/local"), unreadable(".claude/skills")],
	function* ({ sync }) {
		expect(yield* sync()).toMatch(/^failed: PermissionDenied: FileSystem\./u);
	},
);

skills.it(
	"check reports an unreadable sync manifest as a permission failure",
	[selected("alpha"), synced, unreadable(".agents/skills/.shivaedev-skills.json")],
	function* ({ check }) {
		expect(yield* check()).toMatch(/^failed: PermissionDenied: FileSystem\./u);
	},
);

skills.it(
	"the check command logs an unreadable skill as a permission failure and exits unsuccessfully",
	[selected("alpha"), synced, unreadable(".agents/skills/alpha/SKILL.md")],
	function* ({ cli }) {
		const result = yield* cli.check();
		expect(result).toEqual({ exit: 1, stderr: "", stdout: expect.stringContaining("PermissionDenied:") });
	},
);
