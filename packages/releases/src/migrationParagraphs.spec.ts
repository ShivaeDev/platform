import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE, HISTORY, RELEASED_HISTORY } from "#test/fixture.ts";
import { changeset } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const { description, gap } of [
	{ description: "a single paragraph", gap: "" },
	{ description: "a blank line between migration paragraphs", gap: "\n" },
	{ description: "several blank lines between migration paragraphs", gap: "\n\n" },
	{ description: "whitespace-only lines between migration paragraphs", gap: "\n  \n\t\n" },
]) {
	const migration = `- Replace \`old\` with \`current\`.\n${gap}  Pass the service explicitly.`;
	workspace.it(
		`apply preserves ${description} in the migration checklist and changelog without carrying separators into adjacent entries or sections`,
		[
			changeset(
				"migration",
				{ [CORE]: "minor" },
				`\n### Breaking\n\n${migration}\n\n- Remove the old import.\n\n### Changed\n\n- Keep the defaults.\n\n`,
			),
		],
		function* ({ apply, changelog, lastAnswer, todayInUtc }) {
			expect(yield* changelog(CORE)).toBe(HISTORY);

			yield* apply();

			yield* outcomes([
				[
					"migration checklist",
					() => lastAnswer(),
					[
						"## Migration checklist",
						"",
						`### ${CORE}`,
						"",
						...migration.split("\n"),
						"- Remove the old import.",
						"@test/api: 0.5.0 -> 0.5.1 (patch)",
						"@test/core: 0.2.3 -> 0.3.0 (minor)",
						"@test/optional: 1.0.0 -> 1.0.1 (patch)",
						"@test/peer: 1.0.0 -> 1.0.1 (patch)",
					],
				],
				[
					"collected changelog",
					() => changelog(CORE),
					`# Changelog\n\n## 0.3.0 - ${yield* todayInUtc()}\n\n### Changed\n\n- Keep the defaults.\n\n### Breaking\n\n${migration}\n- Remove the old import.\n\n${RELEASED_HISTORY}`,
				],
			]);
		},
	);
}
