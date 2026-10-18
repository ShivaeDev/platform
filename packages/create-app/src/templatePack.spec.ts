import { expect } from "vitest";
import { application } from "#test/application.ts";
import { customTemplate } from "#test/traits.ts";

application.it(
	"keeps nested template-internal names and omits root maintenance files",
	[
		customTemplate({
			"AGENTS.md": "template guidance",
			"CLAUDE.md": "template alias",
			"docs/AGENTS.md": "nested guidance",
			"docs/CLAUDE.md": "nested alias",
			"docs/published-versions.json": "nested versions",
			"docs/README.md": "nested readme",
			"README.md": "template readme",
		}),
	],
	function* ({ pack }) {
		expect(yield* pack()).toEqual({
			"docs/AGENTS.md": "nested guidance",
			"docs/CLAUDE.md": "nested alias",
			"docs/published-versions.json": "nested versions",
			"docs/README.md": "nested readme",
		});
	},
);

application.it(
	"omits local output and secrets and picks up template changes on each pack",
	[customTemplate({}, true)],
	function* ({ changeTemplate, pack }) {
		for (const value of ["first", "changed"]) {
			changeTemplate(value);
			const files = yield* pack();
			expect(files).toEqual({ ".env.example": "example", "app.ts": value });
		}
	},
);

application.it("copies the starter CI workflow with every Action pinned to a commit", [], function* ({ pack, starterFile }) {
	const files = yield* pack();
	const workflow = files[".github/workflows/ci.yml"] ?? "";
	expect(workflow).toBe(starterFile(".github/workflows/ci.yml"));
	for (const [, action] of workflow.matchAll(/uses: (?<action>[^\s]+)/gu)) {
		expect(action).toMatch(/@[a-f0-9]{40}$/u);
	}
});
