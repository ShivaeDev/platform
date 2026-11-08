import { expect } from "@effect/vitest";
import { repositoryPaths } from "#rules/docs/repositoryPaths.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const paths = repositoryHas({ content: "export {};", path: "src/main.ts" }, { content: "Notes", path: "docs/local/notes.txt" });

for (const path of ["src/main.ts", "src/", "../src/main.ts", "./local/notes.txt", "src/main.ts:12", "../src/main.ts#example"]) {
	ruleStory.it(
		`backtick paths accepts ${path}`,
		[paths, repositoryHas({ content: `Read \`${path}\`.`, path: "docs/guide.md" })],
		function* ({ check }) {
			const findings = yield* check(repositoryPaths);

			expect(findings).toEqual([]);
		},
	);
}

for (const path of ["src/missing.ts", "../src/missing.ts", "./missing.txt", "./local/missing.txt", "../../outside.txt"]) {
	ruleStory.it(
		`backtick paths reports ${path} at its document line`,
		[paths, repositoryHas({ content: `# Guide\n\nRead \`${path}\`.`, path: "docs/guide.md" })],
		function* ({ check }) {
			const findings = yield* check(repositoryPaths);

			expect(findings).toEqual([
				{
					file: "docs/guide.md",
					line: 3,
					message: `Repository path "${path}" does not resolve to an existing path inside the repository. Use its current path, relative to this document (./ or ../) or the repository root.`,
					subject: path,
				},
			]);
		},
	);
}

ruleStory.it(
	"backtick paths leaves fenced examples, placeholders, globs, commands, URLs, module specifiers and released changelogs alone",
	[
		paths,
		repositoryHas(
			{
				content: [
					"```md",
					"`src/missing.ts`",
					"```",
					"`packages/<name>/src` `src/*.ts` `pnpm src/run.ts` `https://example.com/src/file.ts` `@shivaedev/service/defineService.ts`",
				].join("\n"),
				path: "docs/guide.md",
			},
			{ content: "Moved `src/missing.ts`.", path: "CHANGELOG.md" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(repositoryPaths);

		expect(findings).toEqual([]);
	},
);
