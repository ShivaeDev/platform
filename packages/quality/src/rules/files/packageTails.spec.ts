import { expect } from "@effect/vitest";
import { folderNames } from "#rules/files/folderNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [folder, names] of [
	["packages/server/domains/agents", ["agents", "agent", "domain-agents", "domains-agent", "server-domain-agent", "servers-domains-agents"]],
	["apps/testing", ["testing", "app-testing", "apps-testing"]],
	["packages/server/edges/categories", ["edge-category", "edges-categories", "categories"]],
] as const) {
	for (const name of names) {
		ruleStory.it(
			`files/folder-names accepts @acme/${name} in ${folder}`,
			[repositoryHas({ content: JSON.stringify({ name: `@acme/${name}` }), path: `${folder}/package.json` })],
			function* ({ check }) {
				const findings = yield* check(folderNames);

				expect(findings).toEqual([]);
			},
		);
	}
}

for (const name of ["unrelated", "server-agents", "domain", "old-agents"]) {
	ruleStory.it(
		`files/folder-names rejects the unrelated name ${name} even beside a matching main file`,
		[
			repositoryHas(
				{ content: JSON.stringify({ name }), path: "packages/server/domains/agents/package.json" },
				{ content: "", path: "packages/server/domains/agents/agents.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(folderNames);

			expect(findings).toEqual([
				{ file: "packages/server/domains/agents", message: expect.stringContaining(`package ${name} must match a trailing run`) },
			]);
		},
	);
}
