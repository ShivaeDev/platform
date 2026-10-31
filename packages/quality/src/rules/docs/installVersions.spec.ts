import { expect } from "vitest";
import { docsUnversionedInstalls } from "#rules/docs/unversionedInstalls.ts";
import { markdown } from "#test/docsRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const PINNED_INSTALLS = [
	{
		line: 4,
		lines: ["```sh", "pnpm add @acme/lib effect@4.0.5", "```"],
		name: "an exact version in a shell block",
		owner: "effect",
		token: "effect@4.0.5",
	},
	{
		line: 3,
		lines: ["Run `npm install -D vitest@^5 typescript` first."],
		name: "a version range in inline code",
		owner: "vitest",
		token: "vitest@^5",
	},
];

const UNPINNED_INSTALLS = [
	{ lines: ["```sh", "pnpm add @acme/lib effect", "```"], name: "an install command that names packages alone" },
	{ lines: ["```sh", "pnpm dlx @acme/create@latest my-app", "```"], name: "a dist-tag such as latest" },
	{ lines: ["```ts", 'const command = "pnpm add effect@4.0.5";', "```"], name: "an install command inside TypeScript code" },
];

for (const { line, lines, name, owner, token } of PINNED_INSTALLS) {
	ruleStory.it(
		`docs/unversioned-installs reports ${name} and names the package to install alone`,
		[repositoryHas(markdown("README.md", "# Tools", "", ...lines))],
		function* ({ check }) {
			const findings = yield* check(docsUnversionedInstalls);

			expect(findings).toEqual([
				{
					file: "README.md",
					line,
					message: `"${token}" pins a version in an install command. Name the package alone, ${owner}: its manifest's version ranges decide what installs, and a version written in documentation goes stale with the next release.`,
					subject: token,
				},
			]);
		},
	);
}

for (const { lines, name } of UNPINNED_INSTALLS) {
	ruleStory.it(`docs/unversioned-installs accepts ${name}`, [repositoryHas(markdown("README.md", "# Tools", "", ...lines))], function* ({ check }) {
		expect(yield* check(docsUnversionedInstalls)).toEqual([]);
	});
}

ruleStory.it(
	"docs/unversioned-installs leaves CHANGELOG.md unchecked, because a released entry keeps the commands of its release",
	[repositoryHas(markdown("CHANGELOG.md", "# Changelog", "", "- Install with `pnpm add effect@4.0.4`."))],
	function* ({ check }) {
		expect(yield* check(docsUnversionedInstalls)).toEqual([]);
	},
);
