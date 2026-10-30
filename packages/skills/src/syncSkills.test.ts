import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ALPHA, ALPHA_NOTES, BETA } from "#test/fixture.ts";
import { skills } from "#test/skills.ts";
import {
	ADDED,
	addedByHand,
	deselects,
	EDITED,
	editedByHand,
	OWN_SKILL,
	ownBrokenLink,
	ownSkill,
	selected,
	selectionEmptied,
	synced,
} from "#test/traits.ts";

skills.it(
	"sync copies alpha's SKILL.md and its references/notes.md into .agents/skills/alpha as real files",
	[selected("alpha")],
	function* ({ folder, sync }) {
		expect(yield* folder(".agents/skills/alpha")).toBe("missing");

		yield* sync();

		expect(yield* folder(".agents/skills/alpha")).toEqual({ "references/notes.md": ALPHA_NOTES, "SKILL.md": ALPHA });
	},
);

skills.it("sync links .claude/skills/alpha to ../../.agents/skills/alpha", [selected("alpha")], function* ({ folder, sync }) {
	expect(yield* folder(".claude/skills/alpha")).toBe("missing");

	yield* sync();

	expect(yield* folder(".claude/skills/alpha")).toBe("link to ../../.agents/skills/alpha");
});

skills.it("sync of alpha alone copies and links alpha but not the shipped beta", [selected("alpha")], function* ({ skillFolders, sync }) {
	expect(yield* skillFolders()).toEqual({ ".agents/skills": [], ".claude/skills": [] });

	yield* sync();

	expect(yield* skillFolders()).toEqual({ ".agents/skills": ["alpha"], ".claude/skills": ["alpha"] });
});

skills.it("sync records version 1.2.0 and a SHA-256 hash of alpha's copy in the manifest", [selected("alpha")], function* ({ manifest, sync }) {
	expect(yield* manifest()).toBe("missing");

	yield* sync();

	expect(yield* manifest()).toEqual({ skills: { alpha: expect.stringMatching(/^[0-9a-f]{64}$/u) }, version: "1.2.0" });
});

skills.it("sync reports the skills it synced and the package version", [selected("alpha", "beta")], function* ({ sync }) {
	expect(yield* sync()).toBe("Synced alpha, beta from @shivaedev/skills 1.2.0.");
});

skills.it(
	"after beta is dropped from the selection, sync removes beta's copy and Claude link and keeps alpha's",
	[selected("alpha", "beta"), synced, deselects("beta")],
	function* ({ skillFolders, sync }) {
		expect(yield* skillFolders()).toEqual({ ".agents/skills": ["alpha", "beta"], ".claude/skills": ["alpha", "beta"] });

		yield* sync();

		expect(yield* skillFolders()).toEqual({ ".agents/skills": ["alpha"], ".claude/skills": ["alpha"] });
	},
);

skills.it(
	"after beta is dropped from the selection, sync reports that it removed beta",
	[selected("alpha", "beta"), synced, deselects("beta")],
	function* ({ sync }) {
		expect(yield* sync()).toBe("Synced alpha from @shivaedev/skills 1.2.0.\nRemoved beta.");
	},
);

skills.it(
	"after the selection is emptied, sync removes alpha and beta and keeps the repository's own skills in both agent directories",
	[selected("alpha", "beta"), ownSkill(".agents/skills/own"), ownSkill(".claude/skills/local"), synced, selectionEmptied],
	function* ({ skillFolders, sync }) {
		expect(yield* skillFolders()).toEqual({ ".agents/skills": ["alpha", "beta", "own"], ".claude/skills": ["alpha", "beta", "local"] });

		yield* sync();

		expect(yield* skillFolders()).toEqual({ ".agents/skills": ["own"], ".claude/skills": ["local"] });
	},
);

skills.it(
	"sync puts back the shipped beta over a hand-edited copy and drops the file added by hand",
	[selected("beta"), synced, editedByHand("beta", "SKILL.md"), addedByHand("beta", "extra.md")],
	function* ({ folder, sync }) {
		expect(yield* folder(".agents/skills/beta")).toEqual({ "extra.md": ADDED, "SKILL.md": EDITED });

		yield* sync();

		expect(yield* folder(".agents/skills/beta")).toEqual({ "SKILL.md": BETA });
	},
);

for (const [owned, at, trait] of [
	["skill", ".agents/skills/alpha", ownSkill(".agents/skills/alpha")],
	["skill", ".claude/skills/alpha", ownSkill(".claude/skills/alpha")],
	["broken link", ".claude/skills/alpha", ownBrokenLink(".claude/skills/alpha")],
] as const) {
	skills.it(
		`sync of alpha refuses to overwrite the repository's own ${owned} at ${at} and names it`,
		[selected("alpha"), trait],
		function* ({ sync }) {
			expect(yield* sync()).toBe(
				`failed: shivaedev-skills sync would overwrite what .agents/skills/.shivaedev-skills.json does not list:\n- ${at}\nRename or remove these, or drop the skill from "shivaedevSkills", then sync again.`,
			);
		},
	);
}

skills.it(
	"sync of alpha and beta names both of the repository's own skills it refuses to overwrite",
	[selected("alpha", "beta"), ownSkill(".agents/skills/alpha"), ownSkill(".claude/skills/beta")],
	function* ({ sync }) {
		expect(yield* sync()).toBe(
			'failed: shivaedev-skills sync would overwrite what .agents/skills/.shivaedev-skills.json does not list:\n- .agents/skills/alpha\n- .claude/skills/beta\nRename or remove these, or drop the skill from "shivaedevSkills", then sync again.',
		);
	},
);

skills.it(
	"a sync refused over the repository's own .claude/skills/beta copies no alpha, writes no manifest and keeps the own beta",
	[selected("alpha", "beta"), ownSkill(".claude/skills/beta")],
	function* ({ folder, manifest, skillFolders, sync }) {
		yield* sync();

		yield* outcomes({
			"own beta": [folder(".claude/skills/beta"), { "SKILL.md": OWN_SKILL }],
			"skill folders": [skillFolders(), { ".agents/skills": [], ".claude/skills": ["beta"] }],
			"sync manifest": [manifest(), "missing"],
		});
	},
);

skills.it(
	"sync of alpha and an unknown gamma fails naming the skills @shivaedev/skills 1.2.0 ships",
	[selected("alpha", "gamma")],
	function* ({ sync }) {
		expect(yield* sync()).toBe("failed: @shivaedev/skills 1.2.0 has no skill named gamma. It ships: alpha, beta.");
	},
);

skills.it("a sync that fails on an unknown gamma copies no alpha", [selected("alpha", "gamma")], function* ({ skillFolders, sync }) {
	yield* sync();

	expect(yield* skillFolders()).toEqual({ ".agents/skills": [], ".claude/skills": [] });
});

skills.it("sync asks for a selection when package.json has no shivaedevSkills", [], function* ({ sync }) {
	expect(yield* sync()).toBe(
		'failed: <repository>/package.json selects no skills. Add the skills this repository uses, such as "shivaedevSkills": ["pr-description"].',
	);
});
