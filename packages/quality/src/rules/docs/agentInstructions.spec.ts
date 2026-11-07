import { expect } from "@effect/vitest";
import { agentLinks } from "#rules/docs/agentLinks.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";

for (const target of ["AGENTS.md", "./AGENTS.md"]) {
	ruleStory.it(
		`agent links accepts a symlink to ${target} beside the instructions`,
		[repositoryHas({ content: "Instructions", path: "docs/AGENTS.md" }), repositoryLinks("docs/CLAUDE.md", target)],
		function* ({ check }) {
			const findings = yield* check(agentLinks);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"agent links reports a copied CLAUDE.md",
	[repositoryHas({ content: "Instructions", path: "CLAUDE.md" }, { content: "Instructions", path: "AGENTS.md" })],
	function* ({ check }) {
		const findings = yield* check(agentLinks);

		expect(findings).toEqual([
			{ file: "CLAUDE.md", message: "Replace CLAUDE.md with a symlink to the AGENTS.md file beside it, and keep the instructions in AGENTS.md." },
		]);
	},
);

for (const target of ["missing.md", "../AGENTS.md", "AGENTS.md"]) {
	ruleStory.it(
		`agent links reports a symlink to ${target} without a sibling AGENTS.md`,
		[repositoryHas({ content: "Instructions", path: "AGENTS.md" }), repositoryLinks("docs/CLAUDE.md", target)],
		function* ({ check, locations }) {
			yield* check(agentLinks);

			expect(yield* locations()).toEqual(["docs/CLAUDE.md"]);
		},
	);
}
