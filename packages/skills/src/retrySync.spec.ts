import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ALPHA, ALPHA_NOTES, BETA } from "#test/fixture.ts";
import { skills } from "#test/skills.ts";
import { aliasedDirectory, unreadableSource } from "#test/syncTraits.ts";
import { alsoSelects, OWN_SKILL, ownSkill, selected, selectionEmptied, synced } from "#test/traits.ts";

skills.it(
	"a first sync that fails during beta's copy succeeds after access is restored and preserves local skills",
	[selected("alpha", "beta"), ownSkill(".agents/skills/own"), ownSkill(".claude/skills/local"), unreadableSource("beta")],
	function* ({ check, folder, restoreSourceAccess, sync }) {
		const failure = yield* sync();

		yield* outcomes([
			["failed copy", () => Effect.succeed(failure), expect.stringMatching(/^failed: PermissionDenied: FileSystem\.copy/u)],
			["completed alpha copy", () => folder(".agents/skills/alpha"), { "references/notes.md": ALPHA_NOTES, "SKILL.md": ALPHA }],
			["incomplete sync check", () => check(), expect.stringMatching(/^failed: The shared skills are out of sync:/u)],
		]);
		yield* restoreSourceAccess("beta");

		yield* sync();

		yield* outcomes([
			["shared skills check", () => check(), "The shared skills match @shivaedev/skills 1.2.0."],
			["copied beta", () => folder(".agents/skills/beta"), { "SKILL.md": BETA }],
			["Claude beta", () => folder(".claude/skills/beta"), "link to ../../.agents/skills/beta"],
			["own skill", () => folder(".agents/skills/own"), { "SKILL.md": OWN_SKILL }],
			["local skill", () => folder(".claude/skills/local"), { "SKILL.md": OWN_SKILL }],
		]);
	},
);

skills.it(
	"a failed sync of newly selected beta can be retried without replacing local skills",
	[selected("alpha"), ownSkill(".agents/skills/own"), synced, alsoSelects("beta"), unreadableSource("beta")],
	function* ({ check, folder, restoreSourceAccess, sync }) {
		expect(yield* sync()).toMatch(/^failed: PermissionDenied: FileSystem\.copy/u);
		yield* restoreSourceAccess("beta");

		yield* sync();

		yield* outcomes([
			["shared skills check", () => check(), "The shared skills match @shivaedev/skills 1.2.0."],
			["own skill", () => folder(".agents/skills/own"), { "SKILL.md": OWN_SKILL }],
		]);
	},
);

for (const [alias, target] of [
	[".claude/skills", "../.agents/skills"],
	[".claude", ".agents"],
] as const) {
	skills.it(
		`sync refuses ${alias} aliased to ${target} before copying or writing a manifest and preserves local skills`,
		[selected("alpha"), ownSkill(".agents/skills/own"), aliasedDirectory(alias, target)],
		function* ({ folder, manifest, sync }) {
			expect(yield* sync()).toBe(
				"failed: .agents/skills and .claude/skills resolve to the same directory. Use separate directories, then sync again.",
			);

			yield* outcomes([
				["shared alpha", () => folder(".agents/skills/alpha"), "missing"],
				["own skill", () => folder(".agents/skills/own"), { "SKILL.md": OWN_SKILL }],
				["directory alias", () => folder(alias), `link to ${target}`],
				["sync manifest", () => manifest(), "missing"],
			]);
		},
	);
}

skills.it(
	"sync refuses an aliased skills directory before removing deselected beta or changing its manifest",
	[selected("beta"), synced, selectionEmptied, aliasedDirectory(".claude/skills", "../.agents/skills")],
	function* ({ folder, manifest, sync }) {
		const before = yield* manifest();

		yield* sync();

		yield* outcomes([
			["shared beta", () => folder(".agents/skills/beta"), { "SKILL.md": BETA }],
			["sync manifest", () => manifest(), before],
		]);
	},
);

skills.it(
	"sync refuses aliased parents before creating absent skills directories",
	[selected("alpha"), aliasedDirectory(".claude", ".agents")],
	function* ({ folder, sync }) {
		const refusal = yield* sync();

		yield* outcomes([
			[
				"sync refusal",
				() => Effect.succeed(refusal),
				"failed: .agents/skills and .claude/skills resolve to the same directory. Use separate directories, then sync again.",
			],
			["agent directory", () => folder(".agents"), "missing"],
		]);
	},
);
