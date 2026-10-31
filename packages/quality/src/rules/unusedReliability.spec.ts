import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas as cliRepositoryHas, qualityInstalled, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { unusedWorktree } from "#test/unusedWorktree.ts";

repositoryStory.it(
	"quality surfaces knip's exit code and broken tsconfig extends error without a schema error",
	[
		qualityInstalled(),
		cliRepositoryHas(
			{ content: '{"name":"broken-app","type":"module","scripts":{"start":"node src/main.ts"}}', path: "package.json" },
			{ content: '{"extends":"./missing-base.json"}', path: "tsconfig.json" },
			{ content: "console.log(1);", path: "src/main.ts" },
		),
	],
	function* ({ runs, stderr }) {
		const answer = yield* runs("lint");

		expect(answer.outcome).toBe("invalid");
		const error = yield* stderr();
		expect(error).toContain("knip exited 1 without a valid report:");
		expect(error).toContain("missing-base.json");
		expect(error).not.toContain("SchemaError");
	},
);

ruleStory.it(
	"code/unused uses the nested worktree's TypeScript config independently of the parent checkout and process cwd",
	[
		repositoryHas(
			{ content: "node_modules/\n.worktrees/\n", path: ".gitignore" },
			{ content: '{"name":"app","type":"module","scripts":{"start":"node src/main.ts"}}', path: "package.json" },
			{ content: '{"compilerOptions":{"paths":{"#app/*":["./src/*"]}},"include":["src"]}', path: "tsconfig.json" },
			{ content: 'import { value } from "#app/value.ts"; console.log(value);', path: "src/main.ts" },
			{ content: "export const value = 1;", path: "src/value.ts" },
		),
		unusedWorktree(),
	],
	function* ({ check, findings }) {
		yield* check(unusedCode, undefined, ".worktrees/app");

		expect(yield* findings()).toEqual([]);
	},
);
